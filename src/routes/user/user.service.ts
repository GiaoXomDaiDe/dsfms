import { Injectable } from '@nestjs/common'
import { NodemailerService } from '~/routes/email/nodemailer.service'
import {
  BulkEidCountMismatchException,
  BulkForbiddenProfileException,
  BulkRequiredProfileMissingException,
  BulkRoleNotFoundAtIndexException,
  BulkTraineeProfileNotAllowedException,
  BulkTrainerProfileNotAllowedException,
  CannotChangeRoleOfActiveDepartmentHeadException,
  CannotChangeRoleTraineeWithOngoingEnrollmentException,
  CannotChangeRoleTrainerWithOngoingCourseException,
  CannotChangeRoleTrainerWithOngoingSubjectException,
  CannotDisableActiveDepartmentHeadException,
  CannotUpdateOrDeleteYourselfException,
  DefaultRoleValidationException,
  DepartmentIsDisabledException,
  ForbiddenProfileException,
  OnlyAdminCanManageAdminRoleException,
  RequiredProfileMissingException,
  RoleIsDisabledException,
  RoleNotFoundException,
  TraineeProfileNotAllowedException,
  TrainerAssignedToOngoingSubjectException,
  TrainerProfileNotAllowedException,
  UserAlreadyExistsException,
  UserIsNotDisabledException,
  UserNotFoundException
} from '~/routes/user/user.error'
import { UserMes } from '~/routes/user/user.message'
import {
  BulkCreateResType,
  BulkUserData,
  CreateBulkUsersBodyType,
  CreateUserBodyType,
  GetUserResType,
  GetUsersResType,
  UpdateUserBodyType
} from '~/routes/user/user.model'
import { UserRepository } from '~/routes/user/user.repo'
import envConfig from '~/shared/config'
import type { RoleNameType } from '~/shared/constants/auth.constant'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import { ROLE_PROFILE_VIOLATION_TYPES } from '~/shared/constants/user.constant'
import {
  evaluateRoleProfileRules,
  isForeignKeyConstraintPrismaError,
  isNotFoundPrismaError,
  isUniqueConstraintPrismaError,
  type RoleProfilePayload
} from '~/shared/helper'
import { RoleType } from '~/shared/models/shared-role.model'
import { SharedCourseRepository } from '~/shared/repositories/shared-course.repo'
import { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import { SharedSubjectRepository } from '~/shared/repositories/shared-subject.repo'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { EidService } from '~/shared/services/eid.service'
import { HashingService } from '~/shared/services/hashing.service'

type RoleValidationSuccess = {
  index: number
  success: true
  targetRole: RoleType
}

type RoleValidationFailure = {
  index: number
  success: false
  error: string
}

type RoleValidationResult = RoleValidationSuccess | RoleValidationFailure

type PreparedBulkUser = BulkUserData & {
  originalIndex: number
}

@Injectable()
export class UserService {
  constructor(
    private readonly hashingService: HashingService,
    private readonly eidService: EidService,
    private readonly nodemailerService: NodemailerService,
    private readonly userRepo: UserRepository,
    private readonly sharedUserRepo: SharedUserRepository,
    private readonly sharedRoleRepo: SharedRoleRepository,
    private readonly sharedCourseRepo: SharedCourseRepository,
    private readonly sharedSubjectRepo: SharedSubjectRepository
  ) {}

  list(): Promise<GetUsersResType> {
    return this.userRepo.list()
  }

  async findById(id: string): Promise<GetUserResType> {
    const user = await this.sharedUserRepo.findUniqueIncludeProfile(id)

    if (!user) {
      throw UserNotFoundException
    }

    return user
  }

  async create({ data, createdById }: { data: CreateUserBodyType; createdById: string }): Promise<GetUserResType> {
    try {
      // Lấy thông tin role mục tiêu
      const targetRole = await this.sharedRoleRepo.findById(data.role.id)

      if (!targetRole) {
        throw RoleNotFoundException
      }

      if (targetRole.isActive !== true || targetRole.deletedAt !== null) {
        throw RoleIsDisabledException
      }

      // Kiểm tra dữ liệu profile có hợp lệ không, đảo bảo an ninh nhiều lớp
      this.validateProfileData(targetRole.name, {
        trainerProfile: data.trainerProfile,
        traineeProfile: data.traineeProfile
      })

      // Sinh eid theo role
      const eid = (await this.eidService.generateEid({ roleName: targetRole.name })) as string
      const hashedPassword = await this.hashingService.hashPassword(eid + envConfig.PASSWORD_SECRET)

      // Tách profile và role ra khỏi data
      const { trainerProfile, traineeProfile, role, ...userData } = data

      const createdUser = await this.userRepo.create({
        createdById,
        userData: {
          ...userData,
          roleId: role.id,
          passwordHash: hashedPassword,
          eid
        },
        roleName: targetRole.name,
        trainerProfile,
        traineeProfile
      })

      if (!createdUser) {
        throw UserNotFoundException
      }

      const userWithProfile = await this.sharedUserRepo.findUniqueIncludeProfile(createdUser.id)
      if (!userWithProfile) {
        throw UserNotFoundException
      }

      // Gửi email chào mừng cho user mới
      try {
        const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')
        const plainPassword = eid + envConfig.PASSWORD_SECRET

        await this.nodemailerService.sendNewUserAccountEmail(data.email, eid, plainPassword, fullName, targetRole.name)

        console.log(`Welcome email sent successfully to ${data.email}`)
      } catch (emailError) {
        // Nếu gửi email lỗi thì chỉ log, không throw
        console.error(`Failed to send welcome email to ${data.email}:`, emailError)
      }
      return userWithProfile
    } catch (error) {
      if (isForeignKeyConstraintPrismaError(error)) {
        throw RoleNotFoundException
      }

      if (isUniqueConstraintPrismaError(error)) {
        throw UserAlreadyExistsException
      }
      throw error
    }
  }

  async createBulk({
    data,
    createdById
  }: {
    data: CreateBulkUsersBodyType
    createdById: string
  }): Promise<BulkCreateResType> {
    try {
      const { users } = data

      // Bước 1: Validate tất cả các role và profile
      const roleValidationPromises: Promise<RoleValidationResult>[] = users.map(async (user, index) => {
        try {
          const targetRole = await this.sharedRoleRepo.findById(user.role.id)
          if (!targetRole) {
            throw BulkRoleNotFoundAtIndexException(index)
          }
          if (targetRole.isActive !== true || targetRole.deletedAt !== null) {
            throw RoleIsDisabledException
          }
          this.validateProfileDataForRole(targetRole.name, user, index)

          return { index, targetRole, success: true as const }
        } catch (error) {
          return {
            index,
            error: error instanceof Error ? error.message : DefaultRoleValidationException.message,
            success: false as const
          }
        }
      })

      const roleValidationResults = await Promise.all(roleValidationPromises)

      const { validUsers, invalidUsers } = roleValidationResults.reduce(
        (acc, result) => {
          const userData = users[result.index]
          if (result.success) {
            acc.validUsers.push({
              index: result.index,
              roleName: result.targetRole.name,
              userData
            })
          } else {
            acc.invalidUsers.push({
              index: result.index,
              error: result.error,
              userData
            })
          }

          return acc
        },
        {
          validUsers: [] as Array<{
            index: number
            roleName: string
            userData: CreateUserBodyType
          }>,
          invalidUsers: [] as Array<{
            index: number
            error: string
            userData: CreateUserBodyType
          }>
        }
      )

      if (validUsers.length === 0) {
        return {
          success: [],
          failed: invalidUsers,
          summary: {
            total: users.length,
            successful: 0,
            failed: users.length
          }
        }
      }

      // Bước 2: Gom nhóm người dùng theo role để sinh EID tối ưu
      const usersByRole = new Map<string, Array<{ userData: CreateUserBodyType; index: number }>>()

      validUsers.forEach(({ userData, roleName, index }) => {
        if (!usersByRole.has(roleName)) {
          usersByRole.set(roleName, [])
        }
        usersByRole.get(roleName)!.push({ userData, index })
      })

      // Bước 3: Sinh EIDs hàng loạt cho từng role và xử lý người dùng
      const preparedUsers: PreparedBulkUser[] = []
      const eidErrors: Array<{ index: number; error: string; userData: CreateUserBodyType }> = []

      for (const [roleName, usersInRoleGroup] of usersByRole) {
        try {
          // Tạo số lượng EID cần thiết cho role này
          const userCount = usersInRoleGroup.length
          const generatedEids = await this.eidService.generateEid({ roleName, count: userCount })
          const eids = Array.isArray(generatedEids) ? generatedEids : [generatedEids]

          if (eids.length !== userCount) {
            throw BulkEidCountMismatchException(userCount, eids.length)
          }

          // Gán EID cho từng người dùng
          for (let i = 0; i < usersInRoleGroup.length; i++) {
            const { userData, index } = usersInRoleGroup[i]
            const eid = eids[i]

            try {
              // Hash mật khẩu
              const hashedPassword = await this.hashingService.hashPassword(eid + envConfig.PASSWORD_SECRET)

              const { trainerProfile, traineeProfile, role, ...userBasicData } = userData

              preparedUsers.push({
                ...userBasicData,
                roleId: role.id,
                passwordHash: hashedPassword,
                eid,
                roleName,
                trainerProfile,
                traineeProfile,
                originalIndex: index
              })
            } catch (error) {
              eidErrors.push({
                index,
                error: `Failed to process user with EID ${eid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                userData
              })
            }
          }
        } catch (error) {
          // Lỗi ở mức độ group (không sinh được EID cho cả role này)
          for (const { userData, index } of usersInRoleGroup) {
            eidErrors.push({
              index,
              error: `Failed to generate EIDs for role ${roleName}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
              userData
            })
          }
        }
      }

      // Gộp tất cả lỗi phát sinh trong quá trình sinh EID
      invalidUsers.push(...eidErrors)

      if (preparedUsers.length === 0) {
        return {
          success: [],
          failed: invalidUsers,
          summary: {
            total: users.length,
            successful: 0,
            failed: users.length
          }
        }
      }

      // Bước 4: Sắp xếp lại theo thứ tự ban đầu của input
      preparedUsers.sort((a, b) => a.originalIndex - b.originalIndex)

      const finalUsersData = preparedUsers.map(({ originalIndex, ...userData }) => userData)

      try {
        const bulkResult = await this.userRepo.createBulk({
          usersData: finalUsersData,
          createdById
        })

        // Gộp tất cả lỗi
        bulkResult.failed.push(...invalidUsers)
        bulkResult.summary.failed += invalidUsers.length
        bulkResult.summary.total = users.length

        // Gửi email chào mừng cho những user tạo thành công
        if (bulkResult.success.length > 0) {
          try {
            const emailUsers = bulkResult.success.map((user) => {
              const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')
              const plainPassword = user.eid + envConfig.PASSWORD_SECRET

              return {
                email: user.email,
                eid: user.eid,
                password: plainPassword,
                fullName,
                role: user.role.name
              }
            })
            // cách làm này có rủi ro, nếu trong lúc trả response mà process NestJS bị dừng, email sẽ không được gửi
            this.nodemailerService.sendBulkNewUserAccountEmails(emailUsers).then((emailResults) => {
              console.log(
                `Bulk email sending completed: ${emailResults.results.filter((r) => r.success).length}/${emailResults.results.length} emails sent successfully`
              )
              // Log từng lỗi email để debug
              emailResults.results.forEach((result) => {
                if (!result.success) {
                  console.error(`Failed to send welcome email to ${result.email}: ${result.message}`)
                }
              })
            })
          } catch (emailError) {
            // Log lỗi gửi email nhưng không làm thất bại việc tạo user
            console.error('Failed to send bulk welcome emails:', emailError)
          }
        }

        return bulkResult
      } catch (dbError) {
        console.error('Database error in bulk creation:', dbError)

        // Nếu lỗi là do ràng buộc duy nhất (unique constraint) thì báo lỗi trùng lặp
        const allFailed = preparedUsers.map(({ originalIndex, eid }) => ({
          index: originalIndex,
          error:
            dbError instanceof Error && dbError.message.includes('Unique constraint')
              ? `Duplicate EID (${eid}) or email detected`
              : 'Database error during user creation',
          userData: users[originalIndex]
        }))

        return {
          success: [],
          failed: [...invalidUsers, ...allFailed],
          summary: {
            total: users.length,
            successful: 0,
            failed: users.length
          }
        }
      }
    } catch (error) {
      console.error('Bulk user creation failed:', error)

      // Trả ra tất cả là failed nếu có lỗi nghiêm trọng
      return {
        success: [],
        failed: data.users.map((userData, index) => ({
          index,
          error: error instanceof Error ? error.message : 'Critical error during bulk creation',
          userData
        })),
        summary: {
          total: data.users.length,
          successful: 0,
          failed: data.users.length
        }
      }
    }
  }

  async update({
    id,
    data,
    updatedById,
    updatedByRoleName
  }: {
    id: string
    data: UpdateUserBodyType
    updatedById: string
    updatedByRoleName: string
  }): Promise<GetUserResType> {
    try {
      // Không thể cập nhật chính mình
      this.verifyYourself({
        userAgentId: updatedById,
        userTargetId: id
      })

      // Bước 2: Lấy thông tin user hiện tại
      const currentUser = await this.sharedUserRepo.findUniqueIncludeProfile(id)
      if (!currentUser) {
        throw UserNotFoundException
      }

      // 2.1. Không cho update user đã bị disable (soft-delete)
      if (currentUser.deletedAt !== null || currentUser.status === UserStatus.DISABLED) {
        // tuỳ bạn chọn exception:
        throw UserIsNotDisabledException // hoặc UserNotFoundException nếu muốn "ẩn" user đã xoá
      }

      // Bước 3: Xử lý role change logic
      const { newRoleName } = await this.processRoleChange({
        data,
        currentUser,
        updatedByRoleName
      })

      // Bước 4: Thực hiện update
      const { role, trainerProfile, traineeProfile, ...userData } = data
      const updatedUser = await this.sharedUserRepo.updateWithProfile(
        { id },
        {
          updatedById,
          userData: {
            ...userData
          },
          newRoleName,
          trainerProfile,
          traineeProfile
        }
      )

      if (!updatedUser) {
        throw UserNotFoundException
      }

      return this.formatUserProfileForRole(updatedUser)
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw UserNotFoundException
      }
      if (isUniqueConstraintPrismaError(error)) {
        throw UserAlreadyExistsException
      }
      if (isForeignKeyConstraintPrismaError(error)) {
        throw RoleNotFoundException
      }
      throw error
    }
  }

  async delete({ id, deletedById }: { id: string; deletedById: string }): Promise<{ message: string }> {
    try {
      // 1. Không được tự xoá chính mình
      this.verifyYourself({ userAgentId: deletedById, userTargetId: id })

      // 2. Lấy user đầy đủ (role, department, profile) để validate
      const user = await this.sharedUserRepo.findUniqueIncludeProfile(id)
      if (!user) {
        throw UserNotFoundException
      }

      // 3. Validate:
      // - Role phải active
      if (!user.role.isActive) {
        throw RoleIsDisabledException
      }

      // - Department head đang có department -> không xoá (đã có logic riêng protect head)
      if (user.role.name === RoleName.DEPARTMENT_HEAD && user.department) {
        throw CannotDisableActiveDepartmentHeadException(user.department.name)
      }

      // Defense-in-depth: nếu vì lý do nào đó user vẫn còn gắn vào department đã bị disable
      // (ví dụ dữ liệu cũ, bug ở chỗ disable department, thao tác tay trên DB)
      // thì không cho phép thao tác tiếp trên user này.
      if (user.department && user.department.isActive !== true) {
        throw DepartmentIsDisabledException
      }

      // - Trainer còn đang dạy subject ON_GOING thì không cho delete
      if (user.role.name === RoleName.TRAINER) {
        const ongoingSubjects = await this.userRepo.findOngoingSubjectsForTrainer(user.id)
        if (ongoingSubjects.length > 0) {
          throw TrainerAssignedToOngoingSubjectException(ongoingSubjects)
        }
      }

      // 4. Thực hiện soft-delete user + profile bên trong repo
      await this.userRepo.delete({ id, deletedById })

      return { message: UserMes.DELETE_SUCCESS }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw UserNotFoundException
      }
      throw error
    }
  }

  async enable({ id, enabledById }: { id: string; enabledById: string }): Promise<{ message: string }> {
    try {
      // 1. Không được tự enable chính mình
      this.verifyYourself({ userAgentId: enabledById, userTargetId: id })

      // 2. Lấy user (bao gồm cả disabled/deleted)
      const user = await this.sharedUserRepo.findUniqueIncludeProfile(id)
      if (!user) {
        throw UserNotFoundException
      }

      // 3. Validate:
      // - Role phải active
      if (!user.role.isActive) {
        throw RoleIsDisabledException
      }

      // - Department phải active (nếu có)
      if (user.department && !user.department.isActive) {
        throw DepartmentIsDisabledException
      }

      // - User phải đang ở trạng thái DISABLED hoặc (status DISABLED + deletedAt != null).
      //   Điều kiện hiện tại:
      if (user.status !== 'DISABLED' && user.deletedAt === null) {
        throw UserIsNotDisabledException
      }

      // 4. Gọi repo enable: user + profile được restore (deletedAt=null, status=ACTIVE)
      await this.userRepo.enable({ id, enabledById })

      return { message: UserMes.ENABLE_SUCCESS }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw UserNotFoundException
      }
      throw error
    }
  }

  /**
   * Không cho phép user tự thao tác (update/delete/enable/disable) chính mình.
   * Nếu agentId === targetId sẽ ném CannotUpdateOrDeleteYourselfException.
   */
  private verifyYourself({ userAgentId, userTargetId }: { userAgentId: string; userTargetId: string }) {
    if (userAgentId === userTargetId) {
      throw CannotUpdateOrDeleteYourselfException
    }
  }

  /**
   * Xử lý toàn bộ logic thay đổi role khi update user:
   * - Case không đổi role: chỉ kiểm tra quyền đụng tới role hiện tại (bảo vệ ADMIN).
   * - Case đổi role:
   *   1. Tìm role mới, đảm bảo role còn active, chưa bị xóa.
   *   2. Gọi ensureRoleChangeAllowed để check các ràng buộc phụ thuộc theo role hiện tại
   *      (trainer/trainee còn ongoing, department head đang active, v.v.).
   *   3. Validate dữ liệu trainerProfile/traineeProfile theo role mới.
   *   4. verifyAdminProtection để đảm bảo chỉ ADMIN mới thao tác được với role ADMIN.
   * Trả về newRoleId/newRoleName dùng cho bước update tiếp theo.
   */
  private async processRoleChange({
    data,
    currentUser,
    updatedByRoleName
  }: {
    data: UpdateUserBodyType
    currentUser: GetUserResType
    updatedByRoleName: string
  }): Promise<{
    newRoleId: string
    newRoleName: RoleNameType
    roleIdForPermissionCheck: string
  }> {
    const { role: inputRole, trainerProfile, traineeProfile } = data

    // Case 1: Không thay đổi role
    if (!inputRole?.id || inputRole.id === currentUser.role.id) {
      await this.verifyAdminProtection({
        roleNameAgent: updatedByRoleName,
        roleIdTarget: currentUser.role.id
      })

      return {
        newRoleId: currentUser.role.id,
        newRoleName: currentUser.role.name as RoleNameType,
        roleIdForPermissionCheck: currentUser.role.id
      }
    }

    // Case 2: Có thay đổi role
    const newRole = await this.sharedRoleRepo.findById(inputRole.id)
    if (!newRole) {
      throw RoleNotFoundException
    }

    if (newRole.isActive !== true || newRole.deletedAt !== null) {
      throw RoleIsDisabledException
    }

    // 1) Kiểm tra các ràng buộc phụ thuộc dựa trên role hiện tại
    await this.ensureRoleChangeAllowed({ currentUser })

    // 2) Validate dữ liệu profile với role mới
    this.validateProfileData(newRole.name, {
      trainerProfile,
      traineeProfile
    })

    // 3) Kiểm tra quyền với role mới (bảo vệ ADMIN)
    await this.verifyAdminProtection({
      roleNameAgent: updatedByRoleName,
      roleIdTarget: inputRole.id
    })

    return {
      newRoleId: inputRole.id,
      newRoleName: newRole.name as RoleNameType,
      roleIdForPermissionCheck: inputRole.id
    }
  }

  /**
   * Kiểm tra quyền hạn khi tác động lên user có role nhất định (đặc biệt là ADMINISTRATOR).
   * - Nếu người thực hiện là ADMINISTRATOR => luôn được phép.
   * - Nếu KHÔNG phải ADMINISTRATOR:
   *   - Không được phép:
   *     + Tạo user ADMINISTRATOR
   *     + Đổi role user thành ADMINISTRATOR
   *     + Xóa/enable/disable user ADMINISTRATOR
   *   - Nếu cố tác động vào role ADMINISTRATOR sẽ ném OnlyAdminCanManageAdminRoleException.
   */
  private async verifyAdminProtection({
    roleNameAgent,
    roleIdTarget
  }: {
    roleNameAgent: string
    roleIdTarget: string
  }) {
    if (roleNameAgent === RoleName.ADMINISTRATOR) {
      return true
    }

    const adminRoleId = await this.sharedRoleRepo.getAdminRoleId()
    if (roleIdTarget === adminRoleId) {
      throw OnlyAdminCanManageAdminRoleException
    }
    return true
  }

  /**
   * Kiểm tra dữ liệu trainerProfile/traineeProfile có phù hợp với role (create/update đơn lẻ).
   * - Phát hiện thiếu profile bắt buộc (TRAINER/TRAINEE) và ném RequiredProfileMissingException.
   * - Phát hiện profile bị cấm xuất hiện với role (ví dụ SQA có trainerProfile) và ném ForbiddenProfileException.
   * - Phát hiện profile không mong đợi (UNEXPECTED_PROFILE) và ném TrainerProfileNotAllowedException /
   *   TraineeProfileNotAllowedException tương ứng.
   * Hàm chỉ xét vi phạm đầu tiên trong danh sách violations và ném exception tương ứng.
   */
  private validateProfileData(roleName: string, data: RoleProfilePayload): void {
    const violations = evaluateRoleProfileRules(roleName, data)
    if (violations.length === 0) {
      return
    }

    const violation = violations[0]

    switch (violation.type) {
      case ROLE_PROFILE_VIOLATION_TYPES.MISSING_REQUIRED:
        throw RequiredProfileMissingException(roleName, violation.profileKey)
      case ROLE_PROFILE_VIOLATION_TYPES.FORBIDDEN_PRESENT:
        throw ForbiddenProfileException(roleName, violation.profileKey, violation.message)
      case ROLE_PROFILE_VIOLATION_TYPES.UNEXPECTED_PROFILE:
        if (violation.profileKey === 'trainerProfile') {
          throw TrainerProfileNotAllowedException(roleName)
        }
        throw TraineeProfileNotAllowedException(roleName)
    }
  }

  /**
   * Kiểm tra dữ liệu profile theo role trong luồng bulk create.
   * - Cùng rule với validateProfileData nhưng:
   *   + Ném các exception dạng Bulk* kèm theo index của user trong mảng.
   * - Ngăn các case như:
   *   + TRAINER thiếu trainerProfile.
   *   + SQA_AUDITOR lại có trainerProfile/traineeProfile.
   */
  private validateProfileDataForRole(roleName: string, userData: CreateUserBodyType, userIndex: number): void {
    const violations = evaluateRoleProfileRules(roleName, userData)
    if (violations.length === 0) {
      return
    }
    const violation = violations[0]
    const { profileKey, message: violationMessage } = violation

    switch (violation.type) {
      case ROLE_PROFILE_VIOLATION_TYPES.MISSING_REQUIRED: {
        throw BulkRequiredProfileMissingException(userIndex, roleName, profileKey, violationMessage)
      }
      case ROLE_PROFILE_VIOLATION_TYPES.FORBIDDEN_PRESENT: {
        throw BulkForbiddenProfileException(userIndex, roleName, profileKey, violationMessage)
      }
      case ROLE_PROFILE_VIOLATION_TYPES.UNEXPECTED_PROFILE:
        if (profileKey === 'trainerProfile') {
          throw BulkTrainerProfileNotAllowedException(userIndex, roleName)
        }
        throw BulkTraineeProfileNotAllowedException(userIndex, roleName)
    }
  }

  /**
   * Chuẩn hóa dữ liệu user trả về theo role:
   * - Nếu role là TRAINER: chỉ expose trainerProfile (ẩn traineeProfile nếu có).
   * - Nếu role là TRAINEE: chỉ expose traineeProfile (ẩn trainerProfile nếu có).
   * - Các role khác: không expose bất kỳ profile nào (trả về baseUser).
   * Dùng ở cuối luồng update/find để response sạch, đúng nghiệp vụ.
   */
  private formatUserProfileForRole(user: GetUserResType): GetUserResType {
    const { trainerProfile, traineeProfile, ...baseUser } = user
    const roleName = user.role.name

    if (roleName === RoleName.TRAINER && trainerProfile) {
      return {
        ...baseUser,
        trainerProfile
      } satisfies GetUserResType
    }

    if (roleName === RoleName.TRAINEE && traineeProfile) {
      return {
        ...baseUser,
        traineeProfile
      } satisfies GetUserResType
    }

    return {
      ...baseUser
    } satisfies GetUserResType
  }

  /**
   * Kiểm tra các ràng buộc nghiệp vụ trước khi cho phép đổi role:
   * - ADMINISTRATOR / SQA_AUDITOR / ACADEMIC_DEPARTMENT: luôn cho phép.
   * - DEPARTMENT_HEAD:
   *   + Nếu user đang là head active của một department (còn gắn departmentId, head tìm được là chính user đó)
   *     -> không cho phép đổi role (CannotChangeRoleOfActiveDepartmentHeadException).
   * - TRAINER:
   *   + Không cho đổi role nếu còn course hoặc subject ở trạng thái ON_GOING (2 exception riêng).
   * - TRAINEE:
   *   + Không cho đổi role nếu còn enrollment ON_GOING.
   * - Các role khác: không áp constraint.
   *
   * Lưu ý: Hàm này chỉ check "có được phép đổi role hay không", không đụng tới dữ liệu profile.
   */
  private async ensureRoleChangeAllowed({ currentUser }: { currentUser: GetUserResType; targetRoleName?: string }) {
    switch (currentUser.role?.name as RoleNameType) {
      case RoleName.ADMINISTRATOR: {
        return
      }
      case RoleName.SQA_AUDITOR: {
        return
      }
      case RoleName.ACADEMIC_DEPARTMENT: {
        return
      }
      case RoleName.DEPARTMENT_HEAD: {
        if (currentUser.department?.id) {
          const head = await this.sharedUserRepo.findDepartmentHeadByDepartment({
            departmentId: currentUser.department.id,
            excludeUserId: undefined
          })

          if (head && head.id === currentUser.id) {
            throw CannotChangeRoleOfActiveDepartmentHeadException(
              currentUser.department.name || 'Unknown Department',
              currentUser.eid
            )
          }
        }
        return
      }
      case RoleName.TRAINER: {
        const hasOngoingCourse = await this.sharedCourseRepo.existsInstructorOngoingCourse(currentUser.id)
        if (hasOngoingCourse) {
          throw CannotChangeRoleTrainerWithOngoingCourseException(currentUser.eid)
        }

        const hasOngoingSubject = await this.sharedSubjectRepo.existsInstructorOngoingSubject(currentUser.id)
        if (hasOngoingSubject) {
          throw CannotChangeRoleTrainerWithOngoingSubjectException(currentUser.eid)
        }
        return
      }
      case RoleName.TRAINEE: {
        const hasOngoingEnrollment = await this.sharedSubjectRepo.existTraineeOngoingEnrollment(currentUser.id)
        if (hasOngoingEnrollment) {
          throw CannotChangeRoleTraineeWithOngoingEnrollmentException(currentUser.eid)
        }
        return
      }
      default: {
        return
      }
    }
  }
}

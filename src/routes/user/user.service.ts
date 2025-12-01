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
  CannotDisableActiveDepartmentHeadException,
  CannotUpdateOrDeleteYourselfException,
  DefaultRoleValidationException,
  DepartmentHeadAlreadyExistsException,
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
  UpdateUserBodyWithProfileType
} from '~/routes/user/user.model'
import { UserRepository } from '~/routes/user/user.repo'
import type { RoleNameType } from '~/shared/constants/auth.constant'
import { RoleName } from '~/shared/constants/auth.constant'
import { ROLE_PROFILE_VIOLATION_TYPES } from '~/shared/constants/user.constant'
import {
  evaluateRoleProfileRules,
  isForeignKeyConstraintPrismaError,
  isNotFoundPrismaError,
  isUniqueConstraintPrismaError,
  type RoleProfilePayload
} from '~/shared/helper'
import { RoleType } from '~/shared/models/shared-role.model'
import { SharedDepartmentRepository } from '~/shared/repositories/shared-department.repo'
import { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { EidService } from '~/shared/services/eid.service'
import { HashingService } from '~/shared/services/hashing.service'

interface ProcessRoleChangeResult {
  newRoleId: string
  newRoleName: RoleNameType
  roleIdForPermissionCheck: string
}

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
    private readonly sharedDepartmentRepo: SharedDepartmentRepository
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

      // Kiểm tra dữ liệu profile có hợp lệ không, đảo bảo an ninh nhiều lớp
      this.validateProfileData(targetRole.name, {
        trainerProfile: data.trainerProfile,
        traineeProfile: data.traineeProfile
      })

      // Sinh eid theo role
      const eid = (await this.eidService.generateEid({ roleName: targetRole.name })) as string
      // Hash mật khẩu mặc định (tạm disable trong giai đoạn dev)
      const hashedPassword = await this.hashingService.hashPassword('123')
      // const hashedPassword = await this.hashingService.hashPassword(eid + envConfig.PASSWORD_SECRET)

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
        const plainPassword = '123'
        // const plainPassword = eid + envConfig.PASSWORD_SECRET

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
            throw new Error(BulkRoleNotFoundAtIndexException(index))
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
              const hashedPassword = await this.hashingService.hashPassword('123')
              // const hashedPassword = await this.hashingService.hashPassword(eid + envConfig.PASSWORD_SECRET)

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
              const plainPassword = '123'
              // const plainPassword = user.eid + envConfig.PASSWORD_SECRET

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
    data: UpdateUserBodyWithProfileType
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

      // Bước 3: Xử lý role change logic
      const { newRoleId, newRoleName } = await this.processRoleChange({
        data,
        currentUser,
        updatedByRoleName
      })

      // // Bước 4: Kiểm tra department exists và active (nếu có)
      // if (data.departmentId !== undefined && data.departmentId !== null) {
      //   const department = await this.sharedDepartmentRepo.findDepartmentById(data.departmentId)
      //   if (!department) {
      //     throw DepartmentNotFoundException
      //   }

      //   // Kiểm tra department có đang active không
      //   if (department.isActive !== true) {
      //     throw DepartmentIsDisabledException
      //   }
      // }

      // // Bước 4.5: Validate unique department head constraint
      // // Chỉ validate nếu role hoặc department đang được thay đổi
      // const isRoleChanging = data.role?.id && data.role.id !== currentUser.role.id
      // const isDepartmentChanging = data.departmentId !== undefined && data.departmentId !== currentUser.department?.id

      // if (isRoleChanging || isDepartmentChanging) {
      //   await this.validateUniqueDepartmentHead({
      //     departmentId: data.departmentId ?? currentUser.department?.id ?? undefined,
      //     roleName: newRoleName,
      //     excludeUserId: id // Important: exclude current user
      //   })
      // }

      // Bước 5: Thực hiện update
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
          traineeProfile,
          includeDeleted: true
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

  /**
   * Xử lý logic thay đổi role: validation, permission check
   */
  private async processRoleChange({
    data,
    currentUser,
    updatedByRoleName
  }: {
    data: UpdateUserBodyWithProfileType
    currentUser: any
    updatedByRoleName: string
  }): Promise<ProcessRoleChangeResult> {
    const { role: inputRole, trainerProfile, traineeProfile } = data

    // Case 1: Không thay đổi role
    if (!inputRole?.id || inputRole.id === currentUser.role.id) {
      await this.verifyRole({
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
    if (currentUser.role.name === RoleName.DEPARTMENT_HEAD && currentUser.department?.id) {
      // Xác nhận user hiện tại có phải department head đang active không
      const isDepartmentHead = await this.sharedUserRepo.findDepartmentHeadByDepartment({
        departmentId: currentUser.department.id,
        excludeUserId: undefined // Don't exclude anyone, check if this user is head
      })

      if (isDepartmentHead && isDepartmentHead.id === currentUser.id) {
        throw CannotChangeRoleOfActiveDepartmentHeadException(
          currentUser.department.name || 'Unknown Department',
          currentUser.eid
        )
      }
    }

    // Lấy thông tin role mới
    const newRole = await this.sharedRoleRepo.findById(inputRole.id)
    if (!newRole) {
      throw RoleNotFoundException
    }

    // Kiểm tra role mới có đang active không
    if (!newRole.isActive) {
      throw RoleIsDisabledException
    }

    // Validate profile với role mới
    this.validateProfileData(newRole.name, {
      trainerProfile,
      traineeProfile
    })

    // Kiểm tra quyền với role mới
    await this.verifyRole({
      roleNameAgent: updatedByRoleName,
      roleIdTarget: inputRole.id
    })

    return {
      newRoleId: inputRole.id,
      newRoleName: newRole.name as RoleNameType,
      roleIdForPermissionCheck: inputRole.id
    }
  }
  private verifyYourself({ userAgentId, userTargetId }: { userAgentId: string; userTargetId: string }) {
    if (userAgentId === userTargetId) {
      throw CannotUpdateOrDeleteYourselfException
    }
  }

  async delete({ id, deletedById }: { id: string; deletedById: string }): Promise<{ message: string }> {
    try {
      // Business rule: Cannot delete yourself
      this.verifyYourself({
        userAgentId: deletedById,
        userTargetId: id
      })

      // Get user info for validation
      const user = await this.sharedUserRepo.findUniqueIncludeProfile(id)
      if (!user) {
        throw UserNotFoundException
      }

      // Business rules: Validate data integrity
      if (!user.role.isActive) {
        throw RoleIsDisabledException
      }

      if (user.role.name === RoleName.DEPARTMENT_HEAD && user.department) {
        throw CannotDisableActiveDepartmentHeadException(user.department.name)
      }

      if (user.department && user.department.isActive !== true) {
        throw DepartmentIsDisabledException
      }

      if (user.role.name === RoleName.TRAINER) {
        const ongoingSubjects = await this.userRepo.findOngoingSubjectsForTrainer(user.id)
        if (ongoingSubjects.length > 0) {
          throw TrainerAssignedToOngoingSubjectException(ongoingSubjects)
        }
      }

      await this.userRepo.delete({
        id,
        deletedById
      })
      return {
        message: UserMes.DELETE_SUCCESS
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw UserNotFoundException
      }
      throw error
    }
  }
  async enable({ id, enabledById }: { id: string; enabledById: string }): Promise<{ message: string }> {
    try {
      // Business rule: Cannot enable yourself
      this.verifyYourself({
        userAgentId: enabledById,
        userTargetId: id
      })

      // Get user info (including disabled users)
      const user = await this.sharedUserRepo.findUniqueIncludeProfile(id)
      if (!user) {
        throw UserNotFoundException
      }

      // Business rules: Validate data integrity
      if (!user.role.isActive) {
        throw RoleIsDisabledException
      }

      if (user.department && !user.department.isActive) {
        throw DepartmentIsDisabledException
      }

      // Business rule: Check if user can be enabled
      if (user.status !== 'DISABLED' && user.deletedAt === null) {
        throw UserIsNotDisabledException
      }

      await this.userRepo.enable({
        id,
        enabledById
      })

      return {
        message: UserMes.ENABLE_SUCCESS
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw UserNotFoundException
      }
      throw error
    }
  }

  /**
   * Kiểm tra bộ dữ liệu profile (trainer/trainee) có hợp lệ với role đang được xử lý hay không.
   * - Phát hiện thiếu profile bắt buộc (ví dụ TRAINER thiếu trainerProfile) và ném lỗi rõ ràng.
   * - Ngăn chặn trường hợp đính kèm profile không hợp lệ cho role hiện tại (ví dụ SQA có trainerProfile).
   * - Giữ nguyên tắc defense-in-depth: ngay cả khi DTO đã validate, service vẫn tự bảo vệ trước dữ liệu sai.
   * Nếu phát hiện vi phạm đầu tiên, hàm sẽ throw exception tương ứng để dừng luồng xử lý ngay lập tức.
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
   * Kiểm tra quyền hạn của người thực hiện đối với role mục tiêu.
   * Chỉ có ADMINISTRATOR mới có quyền:
   * - Tạo user có role ADMINISTRATOR
   * - Cập nhật role thành ADMINISTRATOR
   * - Xóa user có role ADMINISTRATOR
   *
   * Các role khác không được phép tác động đến ADMINISTRATOR.
   *
   * @param roleNameAgent - Role của người thực hiện hành động
   * @param roleIdTarget - ID role của đối tượng bị tác động
   */
  private async verifyRole({ roleNameAgent, roleIdTarget }: { roleNameAgent: string; roleIdTarget: string }) {
    // Nếu người thực hiện là admin thì có toàn quyền
    if (roleNameAgent === RoleName.ADMINISTRATOR) {
      return true
    }

    // Nếu không phải admin thì không được tác động đến admin
    const adminRoleId = await this.sharedRoleRepo.getAdminRoleId()
    if (roleIdTarget === adminRoleId) {
      throw OnlyAdminCanManageAdminRoleException
    }
    return true
  }

  /**
   * Kiểm tra tính hợp lệ của dữ liệu profile theo role cho bulk create.
   * Ngăn chặn các trường hợp như SQA_AUDITOR có trainer/trainee profile.
   *
   * @param roleName - Tên role cần kiểm tra
   * @param userData - Dữ liệu user với profile
   * @param userIndex - Vị trí user trong mảng bulk (để báo lỗi)
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
        const message = BulkRequiredProfileMissingException(userIndex, roleName, profileKey, violationMessage)
        throw new Error(message)
      }
      case ROLE_PROFILE_VIOLATION_TYPES.FORBIDDEN_PRESENT: {
        const message = BulkForbiddenProfileException(userIndex, roleName, profileKey, violationMessage)
        throw new Error(message)
      }
      case ROLE_PROFILE_VIOLATION_TYPES.UNEXPECTED_PROFILE:
        if (profileKey === 'trainerProfile') {
          throw new Error(BulkTrainerProfileNotAllowedException(userIndex, roleName))
        }
        throw new Error(BulkTraineeProfileNotAllowedException(userIndex, roleName))
    }
  }

  private async validateUniqueDepartmentHead({
    departmentId,
    roleName,
    excludeUserId
  }: {
    departmentId?: string
    roleName: string
    excludeUserId?: string
  }): Promise<void> {
    // Chỉ validate khi role là DEPARTMENT_HEAD
    if (roleName !== RoleName.DEPARTMENT_HEAD) {
      return
    }

    // Nếu chưa gán department thì bỏ qua kiểm tra uniqueness
    if (!departmentId) {
      return
    }

    // Kiểm tra xem department đã có head chưa
    const existingHead = await this.sharedUserRepo.findDepartmentHeadByDepartment({
      departmentId,
      excludeUserId
    })

    if (existingHead) {
      // Lấy thông tin department để hiển thị tên
      const department = await this.sharedDepartmentRepo.findDepartmentById(departmentId)
      const departmentName = department?.name || 'Unknown Department'
      const existingHeadFullName = `${existingHead.firstName} ${existingHead.lastName}`.trim()

      throw DepartmentHeadAlreadyExistsException(departmentName, existingHeadFullName, existingHead.eid)
    }
  }

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
}

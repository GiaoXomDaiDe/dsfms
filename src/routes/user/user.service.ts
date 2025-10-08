import { Injectable } from '@nestjs/common'
import { NodemailerService } from '~/routes/email/nodemailer.service'
import {
  BulkDepartmentIsDisabledAtIndexException,
  BulkDepartmentNotFoundAtIndexException,
  BulkForbiddenProfileException,
  BulkRequiredProfileMissingException,
  BulkRoleIsDisabledAtIndexException,
  BulkRoleNotFoundAtIndexException,
  BulkTraineeProfileNotAllowedException,
  BulkTrainerProfileNotAllowedException,
  CannotUpdateOrDeleteYourselfException,
  DefaultRoleValidationException,
  DepartmentIsDisabledException,
  DepartmentNotFoundException,
  ForbiddenProfileException,
  OnlyAdminCanManageAdminRoleException,
  RequiredProfileMissingException,
  RoleIsDisabledException,
  RoleNotFoundException,
  TraineeProfileNotAllowedException,
  TrainerProfileNotAllowedException,
  UserAlreadyExistsException,
  UserIsNotDisabledException,
  UserNotFoundException
} from '~/routes/user/user.error'
import {
  CreateBulkUsersBodyType,
  CreateUserBodyWithProfileType,
  UpdateUserBodyWithProfileType
} from '~/routes/user/user.model'
import { UserRepo } from '~/routes/user/user.repo'
import envConfig from '~/shared/config'
import { RoleName } from '~/shared/constants/auth.constant'
import { ActiveStatus } from '~/shared/constants/default.constant'
import { ROLE_PROFILE_RULES } from '~/shared/constants/role.constant'
import {
  isForeignKeyConstraintPrismaError,
  isNotFoundPrismaError,
  isUniqueConstraintPrismaError
} from '~/shared/helper'
import { SharedDepartmentRepository } from '~/shared/repositories/shared-department.repo'
import { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { EidService } from '~/shared/services/eid.service'
import { HashingService } from '~/shared/services/hashing.service'

interface ProcessRoleChangeResult {
  newRoleId: string
  newRoleName: string
  roleIdForPermissionCheck: string
}

@Injectable()
export class UserService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly hashingService: HashingService,
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly sharedRoleRepository: SharedRoleRepository,
    private readonly sharedDepartmentRepository: SharedDepartmentRepository,
    private readonly eidService: EidService,
    private readonly nodemailerService: NodemailerService
  ) {}

  /**
   * Lấy danh sách người dùng. Chỉ ADMINISTRATOR mới được phép xem user đã bị xóa mềm.
   * @param includeDeleted - Có lấy cả user đã bị xóa mềm không
   * @param userRole - Vai trò của người thực hiện
   */
  list({ includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}) {
    // Nếu không phải admin thì luôn luôn không cho xem user đã bị xóa mềm
    return this.userRepo.list({
      includeDeleted: userRole === RoleName.ADMINISTRATOR ? includeDeleted : false
    })
  }

  /**
   * Lấy thông tin chi tiết một người dùng.
   * Chỉ ADMINISTRATOR mới được phép xem user đã bị xóa mềm.
   * @param id - ID người dùng
   * @param includeDeleted - Có lấy cả user đã bị xóa mềm không
   * @param userRole - Vai trò của người thực hiện
   */
  async findById(
    id: string,
    { includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}
  ) {
    const user = await this.sharedUserRepository.findUniqueIncludeProfile(
      { id },
      { includeDeleted: userRole === RoleName.ADMINISTRATOR ? includeDeleted : false }
    )

    if (!user) {
      throw UserNotFoundException
    }

    const { trainerProfile, traineeProfile, ...baseUser } = user

    // Nếu là trainer thì trả về kèm trainerProfile, trainee thì trả về kèm traineeProfile
    if (user.role.name === RoleName.TRAINER && trainerProfile) {
      return { ...baseUser, trainerProfile }
    } else if (user.role.name === RoleName.TRAINEE && traineeProfile) {
      return { ...baseUser, traineeProfile }
    } else {
      return baseUser
    }
  }

  /**
   * Tạo mới một người dùng.
   * Chỉ admin mới được phép tạo user có role là admin.
   * Kiểm tra hợp lệ profile, department, sinh eid, hash password, gửi email chào mừng.
   */
  async create({
    data,
    createdById,
    createdByRoleName
  }: {
    data: CreateUserBodyWithProfileType
    createdById: string
    createdByRoleName: string
  }) {
    try {
      // Chỉ admin mới được phép tạo user có role là admin
      await this.verifyRole({
        roleNameAgent: createdByRoleName,
        roleIdTarget: data.role.id
      })

      // Lấy thông tin role mục tiêu
      const targetRole = await this.sharedRoleRepository.findRolebyId(data.role.id)
      if (!targetRole) {
        throw RoleNotFoundException
      }

      // Kiểm tra role có đang active không
      if (!targetRole.isActive) {
        throw RoleIsDisabledException
      }

      // Kiểm tra departmentId có tồn tại và active không (nếu được cung cấp)
      if (data.departmentId) {
        const department = await this.sharedDepartmentRepository.findById(data.departmentId)
        if (!department) {
          throw DepartmentNotFoundException
        }

        // Kiểm tra department có đang active không
        if (department.isActive !== ActiveStatus.ACTIVE) {
          throw DepartmentIsDisabledException
        }
      }

      // Kiểm tra dữ liệu profile có hợp lệ không
      this.validateProfileData(targetRole.name, data)
      // Sinh eid theo role
      const eid = (await this.eidService.generateEid({ roleName: targetRole.name })) as string
      // Hash mật khẩu mặc định
      const hashedPassword = await this.hashingService.hashPassword(eid + envConfig.PASSWORD_SECRET)

      // Tách profile và role ra khỏi data
      const { trainerProfile, traineeProfile, role, ...userData } = data

      const user = await this.userRepo.createWithProfile({
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

      // Gửi email chào mừng cho user mới
      try {
        const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')
        const plainPassword = eid + envConfig.PASSWORD_SECRET

        await this.nodemailerService.sendNewUserAccountEmail(data.email, eid, plainPassword, fullName, targetRole.name)

        console.log(`Gửi email chào mừng thành công tới ${data.email}`)
      } catch (emailError) {
        // Nếu gửi email lỗi thì chỉ log, không throw
        console.error(`Gửi email chào mừng thất bại tới ${data.email}:`, emailError)
      }

      return user
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

  /**
   * Tạo mới nhiều người dùng cùng lúc (bulk create).
   * Chỉ admin mới được phép tạo user có role là admin.
   * - Kiểm tra hợp lệ profile, department cho từng user
   * - Sinh eid theo role (tối ưu sinh nhiều eid cùng lúc)
   * - Hash password
   * - Gửi email chào mừng
   */

  async createBulk({
    data,
    createdById,
    createdByRoleName
  }: {
    data: CreateBulkUsersBodyType
    createdById: string
    createdByRoleName: string
  }) {
    try {
      const users = data.users

      // Bước 1: Validate tất cả các role và tính hợp lệ của profile
      const roleValidationPromises = users.map(async (userData, index) => {
        try {
          // Kiểm tra role đang chỉnh có quyền ko
          await this.verifyRole({
            roleNameAgent: createdByRoleName,
            roleIdTarget: userData.role.id
          })

          const targetRole = await this.sharedRoleRepository.findRolebyId(userData.role.id)
          if (!targetRole) {
            throw new Error(BulkRoleNotFoundAtIndexException(index))
          }

          // Kiểm tra role có đang active không
          if (!targetRole.isActive) {
            throw new Error(BulkRoleIsDisabledAtIndexException(index, targetRole.name))
          }

          // Kiểm tra departmentId có tồn tại và active không
          if (userData.departmentId) {
            const department = await this.sharedDepartmentRepository.findById(userData.departmentId)
            if (!department) {
              throw new Error(BulkDepartmentNotFoundAtIndexException(index, userData.departmentId))
            }

            // Kiểm tra department có đang active không
            if (department.isActive !== ActiveStatus.ACTIVE) {
              throw new Error(BulkDepartmentIsDisabledAtIndexException(index, department.name))
            }
          }

          // Kiểm tra profile có đúng không
          this.validateProfileDataForRole(targetRole.name, userData, index)

          return { index, targetRole, success: true }
        } catch (error) {
          return {
            index,
            error: error instanceof Error ? error.message : DefaultRoleValidationException.message,
            success: false
          }
        }
      })

      const roleValidationResults = await Promise.all(roleValidationPromises)

      // Lọc ra những thằng ko hợp lệ và hợp lệ
      const validUsers: Array<{
        userData: CreateUserBodyWithProfileType
        roleName: string
        index: number
      }> = []

      const invalidUsers: Array<{
        index: number
        error: string
        userData: CreateUserBodyWithProfileType
      }> = []

      roleValidationResults.forEach((result) => {
        if (result.success && 'targetRole' in result && result.targetRole) {
          validUsers.push({
            userData: users[result.index],
            roleName: result.targetRole.name,
            index: result.index
          })
        } else if (!result.success && 'error' in result && result.error) {
          invalidUsers.push({
            index: result.index,
            error: result.error,
            userData: users[result.index]
          })
        }
      })

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
      const usersByRole = new Map<string, Array<{ userData: CreateUserBodyWithProfileType; index: number }>>()

      validUsers.forEach(({ userData, roleName, index }) => {
        if (!usersByRole.has(roleName)) {
          usersByRole.set(roleName, [])
        }
        usersByRole.get(roleName)!.push({ userData, index })
      })

      // Bước 3: Sinh EIDs hàng loạt cho từng role và xử lý người dùng
      const processedUsersData = []
      const eidGenerationErrors = []

      for (const [roleName, usersForRole] of usersByRole) {
        try {
          // Tạo số lượng EID cần thiết cho role này
          const count = usersForRole.length
          const generatedEids = await this.eidService.generateEid({ roleName, count })
          const eids = Array.isArray(generatedEids) ? generatedEids : [generatedEids]

          if (eids.length !== count) {
            throw new Error(`Expected ${count} EIDs but got ${eids.length}`)
          }

          // Gán EID cho từng người dùng
          for (let i = 0; i < usersForRole.length; i++) {
            const { userData, index } = usersForRole[i]
            const eid = eids[i]

            try {
              // Hash mật khẩu
              const hashedPassword = await this.hashingService.hashPassword(eid + envConfig.PASSWORD_SECRET)

              const { trainerProfile, traineeProfile, role, ...userBasicData } = userData

              processedUsersData.push({
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
              eidGenerationErrors.push({
                index,
                error: `Failed to process user with EID ${eid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                userData
              })
            }
          }
        } catch (error) {
          usersForRole.forEach(({ userData, index }) => {
            eidGenerationErrors.push({
              index,
              error: `Failed to generate EIDs for role ${roleName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              userData
            })
          })
        }
      }

      // Gộp tất cả lỗi phát sinh trong quá trình sinh EID
      invalidUsers.push(...eidGenerationErrors)

      if (processedUsersData.length === 0) {
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
      processedUsersData.sort((a, b) => a.originalIndex - b.originalIndex)

      const finalUsersData = processedUsersData.map(({ originalIndex, ...userData }) => userData)

      try {
        const bulkResult = await this.userRepo.createBulk({
          usersData: finalUsersData,
          createdById
        })

        // Merge all failures
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

            const emailResults = await this.nodemailerService.sendBulkNewUserAccountEmails(emailUsers)

            console.log(
              `Bulk email sending completed: ${emailResults.results.filter((r) => r.success).length}/${emailResults.results.length} emails sent successfully`
            )

            // Log từng lỗi email để debug
            emailResults.results.forEach((result) => {
              if (!result.success) {
                console.error(`Failed to send welcome email to ${result.email}: ${result.message}`)
              }
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
        const allFailed = processedUsersData.map(({ originalIndex, eid }) => ({
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

      // Trả ra tất cả là thất bại nếu có lỗi nghiêm trọng
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

  /**
   * Kiểm tra tính hợp lệ của dữ liệu profile theo role
   * - TRAINER: bắt buộc có trainerProfile, không được có traineeProfile
   * - TRAINEE: bắt buộc có traineeProfile, không được có trainerProfile
   * - Các role khác: không được có bất kỳ profile nào
   * @param roleName - Tên role cần kiểm tra
   * @param data - Dữ liệu user với profile
   */
  private validateProfileData(roleName: string, data: CreateUserBodyWithProfileType): void {
    const rules = ROLE_PROFILE_RULES[roleName as keyof typeof ROLE_PROFILE_RULES]

    if (rules) {
      // Đối với role có yêu cầu profile cụ thể (TRAINER/TRAINEE)
      const requiredProfile = data[rules.requiredProfile as keyof typeof data]
      const forbiddenProfile = data[rules.forbiddenProfile as keyof typeof data]

      // Kiểm tra thiếu profile bắt buộc
      if (!requiredProfile) {
        throw RequiredProfileMissingException(roleName, rules.requiredProfile)
      }

      // Kiểm tra có profile không được phép
      if (forbiddenProfile) {
        throw ForbiddenProfileException(roleName, rules.forbiddenProfile, rules.forbiddenMessage)
      }
    } else {
      // Đối với các role khác (ADMINISTRATOR, DEPARTMENT_HEAD, SQA_AUDITOR, etc.)
      // không được có bất kỳ profile nào
      if (data.trainerProfile) {
        throw TrainerProfileNotAllowedException(roleName)
      }
      if (data.traineeProfile) {
        throw TraineeProfileNotAllowedException(roleName)
      }
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
    const adminRoleId = await this.sharedRoleRepository.getAdminRoleId()
    if (roleIdTarget === adminRoleId) {
      throw OnlyAdminCanManageAdminRoleException
    }
    return true
  }

  /**
   * Cập nhật thông tin người dùng.
   * Chỉ ADMINISTRATOR mới được phép update user bị disabled.
   * Ví dụ: PUT /users/:userId?includeDeleted=true
   */
  async update({
    id,
    data,
    updatedById,
    updatedByRoleName,
    includeDeleted = false
  }: {
    id: string
    data: UpdateUserBodyWithProfileType
    updatedById: string
    updatedByRoleName: string
    includeDeleted?: boolean
  }) {
    try {
      // Không thể cập nhật chính mình
      this.verifyYourself({
        userAgentId: updatedById,
        userTargetId: id
      })

      // Bước 2: Lấy thông tin user hiện tại
      const currentUser = await this.sharedUserRepository.findUniqueIncludeProfile(
        { id },
        { includeDeleted: updatedByRoleName === RoleName.ADMINISTRATOR ? includeDeleted : false }
      )
      if (!currentUser) {
        throw UserNotFoundException
      }

      // Bước 3: Xử lý role change logic
      const { newRoleId, newRoleName } = await this.processRoleChange({
        data,
        currentUser,
        updatedByRoleName
      })

      // Bước 4: Kiểm tra department exists và active (nếu có)
      if (data.departmentId !== undefined && data.departmentId !== null) {
        const department = await this.sharedDepartmentRepository.findById(data.departmentId)
        if (!department) {
          throw DepartmentNotFoundException
        }

        // Kiểm tra department có đang active không
        if (department.isActive !== 'ACTIVE') {
          throw DepartmentIsDisabledException
        }
      }
      // Bước 5: Thực hiện update
      const { role, trainerProfile, traineeProfile, ...userData } = data
      const updatedUser = await this.sharedUserRepository.updateWithProfile(
        { id },
        {
          updatedById,
          userData: {
            ...userData,
            roleId: newRoleId
          },
          newRoleName,
          trainerProfile,
          traineeProfile,
          includeDeleted: updatedByRoleName === RoleName.ADMINISTRATOR ? includeDeleted : false
        }
      )

      return updatedUser
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
        newRoleName: currentUser.role.name,
        roleIdForPermissionCheck: currentUser.role.id
      }
    }

    // Case 2: Có thay đổi role
    // Lấy thông tin role mới
    const newRole = await this.sharedRoleRepository.findRolebyId(inputRole.id)
    if (!newRole) {
      throw RoleNotFoundException
    }

    // Kiểm tra role mới có đang active không
    if (!newRole.isActive) {
      throw RoleIsDisabledException
    }

    // Validate profile với role mới
    this.validateProfileData(newRole.name, {
      role: inputRole,
      trainerProfile,
      traineeProfile
    } as CreateUserBodyWithProfileType)

    // Kiểm tra quyền với role mới
    await this.verifyRole({
      roleNameAgent: updatedByRoleName,
      roleIdTarget: inputRole.id
    })

    return {
      newRoleId: inputRole.id,
      newRoleName: newRole.name,
      roleIdForPermissionCheck: inputRole.id
    }
  }

  private async getRoleIdByUserId({ userId, includeDeleted }: { userId: string; includeDeleted: boolean }) {
    const currentUser = await this.sharedUserRepository.findUnique(
      {
        id: userId
      },
      { includeDeleted }
    )
    if (!currentUser) {
      throw UserNotFoundException
    }
    return currentUser.roleId
  }

  private verifyYourself({ userAgentId, userTargetId }: { userAgentId: string; userTargetId: string }) {
    if (userAgentId === userTargetId) {
      throw CannotUpdateOrDeleteYourselfException
    }
  }

  async delete({ id, deletedById, deletedByRoleName }: { id: string; deletedById: string; deletedByRoleName: string }) {
    try {
      // Không thể xóa chính mình
      this.verifyYourself({
        userAgentId: deletedById,
        userTargetId: id
      })

      // Lấy thông tin đầy đủ user thay vì chỉ roleId
      // Chỉ admin mới có thể thao tác với user bị disabled (nếu cần)
      const user = await this.sharedUserRepository.findUniqueIncludeProfile(
        { id },
        { includeDeleted: false } // Chỉ delete user đang active
      )
      if (!user) {
        throw UserNotFoundException
      }

      // Kiểm tra role của user có đang active không
      if (!user.role.isActive) {
        throw RoleIsDisabledException
      }

      // Kiểm tra department của user có đang active không (nếu có)
      if (user.department && user.department.isActive !== ActiveStatus.ACTIVE) {
        throw DepartmentIsDisabledException
      }

      await this.verifyRole({
        roleNameAgent: deletedByRoleName,
        roleIdTarget: user.role.id
      })

      await this.userRepo.delete({
        id,
        deletedById
      })
      return {
        message: 'Disable successfully'
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw UserNotFoundException
      }
      throw error
    }
  }
  async enable({ id, enabledById, enabledByRoleName }: { id: string; enabledById: string; enabledByRoleName: string }) {
    try {
      // Không thể enable bản thân
      this.verifyYourself({
        userAgentId: enabledById,
        userTargetId: id
      })

      // Lấy thông tin user (bao gồm cả disabled users) để kiểm tra quyền
      const user = await this.sharedUserRepository.findUniqueIncludeProfile({ id }, { includeDeleted: true })
      if (!user) {
        throw UserNotFoundException
      }

      // Kiểm tra role của user có đang active không
      if (!user.role.isActive) {
        throw RoleIsDisabledException
      }

      // Kiểm tra department của user có đang active không (nếu có)
      if (user.department && user.department.isActive !== ActiveStatus.ACTIVE) {
        throw DepartmentIsDisabledException
      }

      // Kiểm tra quyền
      await this.verifyRole({
        roleNameAgent: enabledByRoleName,
        roleIdTarget: user.role.id
      })

      // Kiểm tra xem user có thực sự bị disabled không
      if (user.status !== 'DISABLED' && user.deletedAt === null) {
        throw UserIsNotDisabledException
      }

      // Thực hiện enable và active lại profile nếu có
      await this.userRepo.enable({
        id,
        enabledById
      })

      return {
        message: 'Enable successfully'
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw UserNotFoundException
      }
      throw error
    }
  }

  /**
   * Kiểm tra tính hợp lệ của dữ liệu profile theo role cho bulk create.
   * Ngăn chặn các trường hợp như SQA_AUDITOR có trainer/trainee profile.
   *
   * @param roleName - Tên role cần kiểm tra
   * @param userData - Dữ liệu user với profile
   * @param userIndex - Vị trí user trong mảng bulk (để báo lỗi)
   */
  private validateProfileDataForRole(
    roleName: string,
    userData: CreateUserBodyWithProfileType,
    userIndex: number
  ): void {
    const rules = ROLE_PROFILE_RULES[roleName as keyof typeof ROLE_PROFILE_RULES]

    if (rules) {
      // Đối với role có yêu cầu profile cụ thể (TRAINER/TRAINEE)
      const requiredProfile = userData[rules.requiredProfile as keyof typeof userData]
      const forbiddenProfile = userData[rules.forbiddenProfile as keyof typeof userData]

      // Kiểm tra thiếu profile bắt buộc
      if (!requiredProfile) {
        throw new Error(
          BulkRequiredProfileMissingException(userIndex, roleName, rules.requiredProfile, rules.requiredMessage)
        )
      }

      // Kiểm tra có profile không được phép
      if (forbiddenProfile) {
        throw new Error(
          BulkForbiddenProfileException(userIndex, roleName, rules.forbiddenProfile, rules.forbiddenMessage)
        )
      }
    } else {
      // Đối với các role khác (SQA_AUDITOR, ADMINISTRATOR, DEPARTMENT_HEAD, etc.)
      // không được có bất kỳ profile nào
      if (userData.trainerProfile) {
        throw new Error(BulkTrainerProfileNotAllowedException(userIndex, roleName))
      }
      if (userData.traineeProfile) {
        throw new Error(BulkTraineeProfileNotAllowedException(userIndex, roleName))
      }
    }
  }
}

import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common'
import { NodemailerService } from '~/routes/email/nodemailer.service'
import {
  CannotUpdateOrDeleteYourselfException,
  DefaultRoleValidationException,
  RoleNotFoundException,
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
import { ROLE_PROFILE_RULES } from '~/shared/constants/role.constant'
import {
  isForeignKeyConstraintPrismaError,
  isNotFoundPrismaError,
  isUniqueConstraintPrismaError
} from '~/shared/helper'
import { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { EidService } from '~/shared/services/eid.service'
import { HashingService } from '~/shared/services/hashing.service'

@Injectable()
export class UserService {
  constructor(
    private userRepo: UserRepo,
    private hashingService: HashingService,
    private sharedUserRepository: SharedUserRepository,
    private sharedRoleRepository: SharedRoleRepository,
    private readonly eidService: EidService,
    private readonly nodemailerService: NodemailerService
  ) {}

  list({ includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}) {
    // Chỉ admin mới có thể xem các user đã bị xóa mềm
    const canViewDeleted = userRole === RoleName.ADMINISTRATOR
    return this.userRepo.list({
      includeDeleted: canViewDeleted ? includeDeleted : false
    })
  }

  async findById(
    id: string,
    { includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}
  ) {
    // Admin có thể xem detail của user đã bị disable
    const canViewDeleted = userRole === RoleName.ADMINISTRATOR

    // Tạm thời sử dụng repo method hiện có
    // TODO: Cần cập nhật shared repository để support includeDeleted
    const user = await this.sharedUserRepository.findUniqueIncludeProfile({ id })

    // Nếu user null và admin muốn xem deleted items, cần implement logic riêng
    if (!user && includeDeleted && canViewDeleted) {
      // Tạm thời throw error, cần implement sau
      throw UserNotFoundException
    }

    if (!user) {
      throw UserNotFoundException
    }

    const { trainerProfile, traineeProfile, ...baseUser } = user

    if (user.role.name === RoleName.TRAINER && trainerProfile) {
      return { ...baseUser, trainerProfile }
    } else if (user.role.name === RoleName.TRAINEE && traineeProfile) {
      return { ...baseUser, traineeProfile }
    } else {
      return baseUser
    }
  }

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
      // Chỉ có admin agent mới có quyền tạo user với role là admin
      await this.verifyRole({
        roleNameAgent: createdByRoleName,
        roleIdTarget: data.role.id
      })

      // Lấy ra role detail
      const targetRole = await this.sharedRoleRepository.findRolebyId(data.role.id)
      if (!targetRole) {
        throw RoleNotFoundException
      }

      //Kiểm tra departmentId dựa trên role
      if (data.departmentId) {
        if (targetRole.name !== RoleName.DEPARTMENT_HEAD && targetRole.name !== RoleName.TRAINER) {
          throw new ForbiddenException(
            `Users with role ${targetRole.name} cannot be assigned to a department. Only TRAINER and DEPARTMENT_HEAD roles are allowed.`
          )
        }
      }
      // Kiểm tra dữ liệu profile có hợp lệ không
      this.validateProfileData(targetRole.name, data)
      // Tạo eid dựa theo role
      const eid = (await this.eidService.generateEid({ roleName: targetRole.name })) as string
      // Hash the password
      const hashedPassword = await this.hashingService.hashPassword(eid + envConfig.PASSWORD_SECRET)

      //extract profile data if exists
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

      // Send welcome email to the new user
      try {
        const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')
        const plainPassword = eid + envConfig.PASSWORD_SECRET

        await this.nodemailerService.sendNewUserAccountEmail(data.email, eid, plainPassword, fullName, targetRole.name)

        console.log(`Welcome email sent successfully to ${data.email}`)
      } catch (emailError) {
        // Log email error but don't fail the user creation
        console.error(`Failed to send welcome email to ${data.email}:`, emailError)
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
            throw new Error(`Role not found for user at index ${index}`)
          }

          // Kiểm tra departmentId có tồn tại không
          if (userData.departmentId) {
            if (targetRole.name !== RoleName.DEPARTMENT_HEAD && targetRole.name !== RoleName.TRAINER) {
              throw new Error(
                `User at index ${index}: Department assignment not allowed for ${targetRole.name} role. Only TRAINER and DEPARTMENT_HEAD roles are allowed.`
              )
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

        // Send welcome emails to successfully created users
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

            // Log individual email failures for debugging
            emailResults.results.forEach((result) => {
              if (!result.success) {
                console.error(`Failed to send welcome email to ${result.email}: ${result.message}`)
              }
            })
          } catch (emailError) {
            // Log email error but don't fail the user creation
            console.error('Failed to send bulk welcome emails:', emailError)
          }
        }

        return bulkResult
      } catch (dbError) {
        console.error('Database error in bulk creation:', dbError)

        // Convert all processed users to failed status
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

      // Return all as failed if there's a critical error
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

  private validateProfileData(roleName: string, data: CreateUserBodyWithProfileType): void {
    // Validate that correct profile is provided for role
    if (roleName === RoleName.TRAINER && data.traineeProfile) {
      throw new ConflictException('Cannot provide trainee profile for trainer role')
    }
    if (roleName === RoleName.TRAINEE && data.trainerProfile) {
      throw new ConflictException('Cannot provide trainer profile for trainee role')
    }

    // Optional: Warn if profile data is missing
    if (roleName === RoleName.TRAINER && !data.trainerProfile) {
      console.warn('Creating trainer without profile data')
    }
    if (roleName === RoleName.TRAINEE && !data.traineeProfile) {
      console.warn('Creating trainee without profile data')
    }
  }

  /**
   * Function này kiểm tra xem người thực hiện có quyền tác động đến người khác không.
   * Vì chỉ có người thực hiện là admin role mới có quyền sau: Tạo admin user, update roleId thành admin, xóa admin user.
   * Còn nếu không phải admin thì không được phép tác động đến admin
   */
  private async verifyRole({ roleNameAgent, roleIdTarget }: { roleNameAgent: string; roleIdTarget: string }) {
    // Agent là admin thì cho phép
    if (roleNameAgent === RoleName.ADMINISTRATOR) {
      return true
    } else {
      // Agent không phải admin thì roleIdTarget phải khác admin
      const adminRoleId = await this.sharedRoleRepository.getAdminRoleId()
      if (roleIdTarget === adminRoleId) {
        throw new ForbiddenException()
      }
      return true
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
  }) {
    try {
      // Không thể cập nhật chính mình
      this.verifyYourself({
        userAgentId: updatedById,
        userTargetId: id
      })

      // Lấy roleId ban đầu của người được update để kiểm tra xem liệu người update có quyền update không
      // Không dùng data.roleId vì dữ liệu này có thể bị cố tình truyền sai
      const roleIdTarget = await this.getRoleIdByUserId(id)
      const currentUser = await this.sharedUserRepository.findUniqueIncludeProfile({ id })
      if (!currentUser) {
        throw UserNotFoundException
      }
      await this.verifyRole({
        roleNameAgent: updatedByRoleName,
        roleIdTarget
      })
      const { role, trainerProfile, traineeProfile, ...userData } = data

      const targetRoleName = role
        ? (await this.sharedRoleRepository.findRolebyId(role.id))?.name || currentUser.role.name
        : currentUser.role.name
      // Update user with profile
      const updatedUser = await this.sharedUserRepository.updateWithProfile(
        { id },
        {
          updatedById,
          userData: {
            ...userData,
            roleId: role?.id || currentUser.role.id
          },
          newRoleName: targetRoleName,
          trainerProfile,
          traineeProfile
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

  private async getRoleIdByUserId(userId: string) {
    const currentUser = await this.sharedUserRepository.findUnique({
      id: userId
    })
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

      const roleIdTarget = await this.getRoleIdByUserId(id)
      await this.verifyRole({
        roleNameAgent: deletedByRoleName,
        roleIdTarget
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
      //Không thể enable bản thân
      this.verifyYourself({
        userAgentId: enabledById,
        userTargetId: id
      })

      //Lấy ra user để kiểm tra quyền
      const user = await this.sharedUserRepository.findDisableUniqueIncludeProfile({ id })
      if (!user) throw UserNotFoundException

      //Kiểm tra quyền
      await this.verifyRole({
        roleNameAgent: enabledByRoleName,
        roleIdTarget: user.roleId
      })

      //Kiểm tra xem trường hợp đã enabled r
      if (user.status !== 'DISABLED' && user.deletedAt === null) {
        throw UserIsNotDisabledException
      }
      // Thực hiện enable và active lại profile nếu có
      const enableUser = await this.userRepo.enable({
        id,
        enabledById
      })
      console.log('user', user)
      return enableUser
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw UserNotFoundException
      }
      throw error
    }
  }

  /**
   * Validate that profile data matches the user's role
   * Prevents cases like SQA_AUDITOR having trainer/trainee profile
   */
  private validateProfileDataForRole(
    roleName: string,
    userData: CreateUserBodyWithProfileType,
    userIndex: number
  ): void {
    const rules = ROLE_PROFILE_RULES[roleName as keyof typeof ROLE_PROFILE_RULES]

    if (rules) {
      // For roles that have specific profile requirements (TRAINER/TRAINEE)
      const forbiddenKey = rules.forbiddenProfile as keyof typeof userData
      if (forbiddenKey in userData && userData[forbiddenKey]) {
        throw new Error(`User at index ${userIndex}: ${rules.forbiddenMessage}`)
      }
    } else {
      // For other roles (SQA_AUDITOR, ADMINISTRATOR, etc.) - should NOT have any profile
      if (userData.trainerProfile) {
        throw new Error(`User at index ${userIndex}: Trainer profile is not allowed for ${roleName} role`)
      }
      if (userData.traineeProfile) {
        throw new Error(`User at index ${userIndex}: Trainee profile is not allowed for ${roleName} role`)
      }
    }
  }
}

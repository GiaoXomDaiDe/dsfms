import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { CreateTraineeProfileType, CreateTrainerProfileType } from '~/routes/profile/profile.model'
import {
  BulkDuplicateDataFoundMessage,
  BulkEmailAlreadyExistsMessage,
  BulkUnknownErrorMessage,
  UserNotFoundException
} from '~/routes/user/user.error'
import {
  BulkCreateResultType,
  BulkUserData,
  CreateUserInternalType,
  GetUserProfileResType,
  GetUsersQueryType,
  UserType
} from '~/routes/user/user.model'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import { SubjectStatus } from '~/shared/constants/subject.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { GetUsersResType } from '~/shared/models/shared-user.model'
import { PrismaService } from '~/shared/services/prisma.service'

const roleNameSelect = {
  name: true
} satisfies Prisma.RoleSelect

const roleIdNameSelect = {
  id: true,
  name: true,
  description: true,
  isActive: true
} satisfies Prisma.RoleSelect

const departmentNameSelect = {
  name: true
} satisfies Prisma.DepartmentSelect

const departmentIdNameSelect = {
  id: true,
  name: true,
  isActive: true
} satisfies Prisma.DepartmentSelect

const userRoleNameInclude = {
  role: {
    select: roleNameSelect
  }
} satisfies Prisma.UserInclude

const userRoleDepartmentNameInclude = {
  role: {
    select: roleNameSelect
  },
  department: {
    select: departmentNameSelect
  }
} satisfies Prisma.UserInclude

const userRoleDepartmentInclude = {
  role: {
    select: roleIdNameSelect
  },
  department: {
    select: departmentIdNameSelect
  }
} satisfies Prisma.UserInclude

const userRoleDepartmentProfileInclude = {
  role: {
    select: roleIdNameSelect
  },
  department: {
    select: departmentIdNameSelect
  },
  trainerProfile: true,
  traineeProfile: true
} satisfies Prisma.UserInclude

@Injectable()
@SerializeAll()
export class UserRepo {
  constructor(private prismaService: PrismaService) {}

  async list({ roleName }: GetUsersQueryType = {}): Promise<GetUsersResType> {
    const whereClause: Prisma.UserWhereInput = roleName
      ? {
          role: {
            name: roleName
          }
        }
      : {}

    const data = await this.prismaService.user.findMany({
      where: whereClause,
      omit: {
        passwordHash: true,
        signatureImageUrl: true,
        roleId: true,
        departmentId: true
      },
      include: userRoleDepartmentInclude
    })
    return {
      users: data,
      totalItems: data.length
    }
  }

  async createWithProfile({
    createdById,
    userData,
    roleName,
    trainerProfile,
    traineeProfile
  }: {
    createdById: string | null
    userData: CreateUserInternalType
    roleName: string
    trainerProfile?: CreateTrainerProfileType
    traineeProfile?: CreateTraineeProfileType
  }): Promise<GetUserProfileResType | null> {
    return await this.prismaService.$transaction(async (tx) => {
      // Bước 1: Tạo user cơ bản
      const newUser = await tx.user.create({
        data: {
          ...userData,
          createdById
        },
        include: userRoleDepartmentNameInclude
      })

      // Bước 2: Tạo profile tương ứng dựa trên role
      if (roleName === RoleName.TRAINER && trainerProfile) {
        await tx.trainerProfile.create({
          data: {
            userId: newUser.id,
            specialization: trainerProfile.specialization,
            certificationNumber: trainerProfile.certificationNumber,
            yearsOfExp: Number(trainerProfile.yearsOfExp),
            bio: trainerProfile.bio,
            createdById
          }
        })
      } else if (roleName === RoleName.TRAINEE && traineeProfile) {
        await tx.traineeProfile.create({
          data: {
            userId: newUser.id,
            dob: traineeProfile.dob,
            enrollmentDate: new Date(traineeProfile.enrollmentDate || ''),
            trainingBatch: traineeProfile.trainingBatch,
            passportNo: traineeProfile.passportNo,
            nation: traineeProfile.nation || null,
            createdById
          }
        })
      }

      // Bước 3: Trả về user hoàn chỉnh với profile
      return await tx.user.findUnique({
        where: { id: newUser.id },
        include: userRoleDepartmentProfileInclude
      })
    })
  }

  async createBulk({
    usersData,
    createdById,
    chunkSize = 50
  }: {
    usersData: BulkUserData[]
    createdById: string
    chunkSize?: number
  }): Promise<BulkCreateResultType> {
    const results: BulkCreateResultType = {
      success: [],
      failed: [],
      summary: {
        total: usersData.length,
        successful: 0,
        failed: 0
      }
    }

    // Xử lý theo chunks để tránh vấn đề memory và timeout database
    for (let i = 0; i < usersData.length; i += chunkSize) {
      const chunk = usersData.slice(i, i + chunkSize)

      try {
        const chunkResults = await this.prismaService.$transaction(
          async (tx) => {
            // Bước 0: Kiểm tra email đã tồn tại trong chunk này
            const emails = chunk.map((userData) => userData.email)
            const existingUsers = await tx.user.findMany({
              where: {
                email: { in: emails },
                deletedAt: null
              },
              select: { email: true }
            })

            const existingEmails = new Set(existingUsers.map((u) => u.email))

            // Tách users hợp lệ khỏi những users trùng lặp
            const validUsersInChunk: typeof chunk = []
            const duplicateUsersInChunk: Array<{ userData: (typeof chunk)[0]; originalIndex: number }> = []

            chunk.forEach((userData, chunkIndex) => {
              if (existingEmails.has(userData.email)) {
                duplicateUsersInChunk.push({
                  userData,
                  originalIndex: i + chunkIndex
                })
              } else {
                validUsersInChunk.push(userData)
              }
            })

            // Nếu không có users hợp lệ trong chunk này, trả về kết quả rỗng
            if (validUsersInChunk.length === 0) {
              return {
                created: [],
                duplicates: duplicateUsersInChunk
              }
            }

            // Bước 1: Tạo hàng loạt chỉ những users hợp lệ
            const usersToCreate = validUsersInChunk.map((userData) => ({
              ...userData,
              createdById,
              // Loại bỏ dữ liệu profile khỏi quá trình tạo user
              trainerProfile: undefined,
              traineeProfile: undefined,
              roleName: undefined
            }))

            const createdUsers = await tx.user.createManyAndReturn({
              data: usersToCreate,
              include: userRoleDepartmentInclude
            })

            // Bước 2: Tạo hàng loạt profiles (tách riêng để tối ưu hiệu suất)
            const trainerProfiles: any[] = []
            const traineeProfiles: any[] = []

            validUsersInChunk.forEach((userData, index) => {
              const userId = createdUsers[index].id

              if (userData.roleName === RoleName.TRAINER && userData.trainerProfile) {
                trainerProfiles.push({
                  userId,
                  specialization: userData.trainerProfile.specialization,
                  certificationNumber: userData.trainerProfile.certificationNumber,
                  yearsOfExp: Number(userData.trainerProfile.yearsOfExp),
                  bio: userData.trainerProfile.bio,
                  createdById
                })
              }

              if (userData.roleName === RoleName.TRAINEE && userData.traineeProfile) {
                traineeProfiles.push({
                  userId,
                  dob: userData.traineeProfile.dob,
                  enrollmentDate: new Date(userData.traineeProfile.enrollmentDate || ''),
                  trainingBatch: userData.traineeProfile.trainingBatch,
                  passportNo: userData.traineeProfile.passportNo || null,
                  nation: userData.traineeProfile.nation || null,
                  createdById
                })
              }
            })

            // Tạo hàng loạt profiles
            if (trainerProfiles.length > 0) {
              await tx.trainerProfile.createMany({
                data: trainerProfiles
              })
            }

            if (traineeProfiles.length > 0) {
              await tx.traineeProfile.createMany({
                data: traineeProfiles
              })
            }

            // Bước 3: Lấy thông tin users hoàn chỉnh kèm profiles
            const completeUsers = await tx.user.findMany({
              where: {
                id: { in: createdUsers.map((u) => u.id) }
              },
              include: {
                ...userRoleDepartmentInclude,
                trainerProfile: true,
                traineeProfile: true
              }
            })

            const finalUsers = completeUsers.map((user) => {
              const { trainerProfile, traineeProfile, ...baseUser } = user

              if (user.role.name === RoleName.TRAINER && trainerProfile) {
                return { ...baseUser, trainerProfile }
              } else if (user.role.name === RoleName.TRAINEE && traineeProfile) {
                return { ...baseUser, traineeProfile }
              } else {
                return baseUser
              }
            })

            return {
              created: finalUsers,
              duplicates: duplicateUsersInChunk
            }
          },
          {
            timeout: 30000
          }
        )

        // Xử lý các tạo thành công
        results.success.push(...chunkResults.created)
        results.summary.successful += chunkResults.created.length

        // Xử lý các email trùng lặp được tìm thấy trước khi tạo
        chunkResults.duplicates.forEach(({ userData, originalIndex }) => {
          // Extract original user data without internal fields
          const { roleId, passwordHash, eid, roleName, ...originalUserData } = userData

          const failedUserData = {
            ...originalUserData,
            role: { id: roleId, name: roleName }
          }

          results.failed.push({
            index: originalIndex,
            error: BulkEmailAlreadyExistsMessage(originalUserData.email),
            userData: failedUserData
          })
        })
        results.summary.failed += chunkResults.duplicates.length
      } catch (error) {
        // Xử lý lỗi chunk - thêm tất cả users trong chunk này vào mảng thất bại
        chunk.forEach((userData, index) => {
          // Tách dữ liệu user gốc không bao gồm các field nội bộ
          const { roleId, passwordHash, eid, roleName, ...originalUserData } = userData

          // Tái tạo role object cho response thất bại
          const failedUserData = {
            ...originalUserData,
            role: { id: roleId, name: roleName }
          }

          let errorMessage = BulkUnknownErrorMessage
          if (error instanceof Error) {
            if (error.message.includes('Unique constraint failed on the fields: (`email`)')) {
              errorMessage = BulkEmailAlreadyExistsMessage(originalUserData.email)
            } else if (error.message.includes('Unique constraint failed')) {
              errorMessage = BulkDuplicateDataFoundMessage
            } else {
              errorMessage = error.message
            }
          }

          results.failed.push({
            index: i + index,
            error: errorMessage,
            userData: failedUserData
          })
        })
        results.summary.failed += chunk.length

        console.error(`Bulk create chunk ${i}-${i + chunkSize} failed:`, error)
      }
    }

    return results
  }

  async updateWithProfile(
    {
      id
    }: {
      id: string
    },
    {
      updatedById,
      userData,
      roleName,
      trainerProfile,
      traineeProfile
    }: {
      id: string
      updatedById: string
      userData: Partial<CreateUserInternalType>
      roleName: string
      trainerProfile?: any
      traineeProfile?: any
    }
  ): Promise<GetUserProfileResType | null> {
    return await this.prismaService.$transaction(async (tx) => {
      // Cập nhật thông tin user cơ bản nếu có dữ liệu
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id },
          data: {
            ...userData,
            updatedById
          }
        })
      }

      // Cập nhật hoặc tạo mới profile theo role
      if (roleName === RoleName.TRAINER && trainerProfile) {
        await tx.trainerProfile.upsert({
          where: { userId: id },
          create: {
            userId: id,
            ...trainerProfile
          },
          update: trainerProfile
        })
      } else if (roleName === RoleName.TRAINEE && traineeProfile) {
        await tx.traineeProfile.upsert({
          where: { userId: id },
          create: {
            userId: id,
            ...traineeProfile
          },
          update: traineeProfile
        })
      }

      // Trả về user đã được cập nhật kèm profile
      return await tx.user.findUnique({
        where: { id },
        include: userRoleDepartmentProfileInclude
      })
    })
  }

  async findOngoingSubjectsForTrainer(trainerId: string): Promise<Array<{ id: string; code: string; name: string }>> {
    return this.prismaService.subject.findMany({
      where: {
        deletedAt: null,
        status: SubjectStatus.ON_GOING,
        instructors: {
          some: {
            trainerUserId: trainerId
          }
        }
      },
      select: {
        id: true,
        code: true,
        name: true
      }
    })
  }

  delete(
    {
      id,
      deletedById
    }: {
      id: string
      deletedById: string
    },
    isHard?: boolean
  ): Promise<UserType> {
    return isHard
      ? this.prismaService.$transaction(async (tx) => {
          await tx.trainerProfile.deleteMany({
            where: { userId: id }
          })

          await tx.traineeProfile.deleteMany({
            where: { userId: id }
          })

          return tx.user.delete({
            where: { id }
          })
        })
      : this.prismaService.$transaction(async (tx) => {
          await tx.trainerProfile.updateMany({
            where: { userId: id, deletedAt: null },
            data: { deletedAt: new Date(), deletedById: deletedById }
          })

          await tx.traineeProfile.updateMany({
            where: { userId: id, deletedAt: null },
            data: { deletedAt: new Date(), deletedById: deletedById }
          })

          return tx.user.update({
            where: { id, deletedAt: null },
            data: {
              status: UserStatus.DISABLED,
              deletedAt: new Date(),
              deletedById
            }
          })
        })
  }
  enable({ id, enabledById }: { id: string; enabledById: string }) {
    return this.prismaService.$transaction(async (tx) => {
      // Lấy thông tin user với role
      const user = await tx.user.findUnique({
        where: { id },
        include: userRoleNameInclude
      })
      if (!user) throw UserNotFoundException

      // Kích hoạt lại user
      await tx.user.update({
        where: { id },
        data: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
          deletedById: null,
          updatedById: enabledById
        }
      })
      // Kích hoạt lại các profile tương ứng
      await tx.trainerProfile.updateMany({
        where: { userId: id, deletedAt: { not: null } },
        data: {
          deletedAt: null,
          deletedById: null,
          updatedById: enabledById
        }
      })
      await tx.traineeProfile.updateMany({
        where: { userId: id, deletedAt: { not: null } },
        data: {
          deletedAt: null,
          deletedById: null,
          updatedById: enabledById
        }
      })

      return await tx.user.findUnique({
        where: { id, deletedAt: null },
        include: {
          ...userRoleDepartmentInclude,
          trainerProfile: user.role.name === RoleName.TRAINER,
          traineeProfile: user.role.name === RoleName.TRAINEE
        }
      })
    })
  }
}

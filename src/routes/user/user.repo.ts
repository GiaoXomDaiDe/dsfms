import { Injectable } from '@nestjs/common'
import { CreateTraineeProfileType, CreateTrainerProfileType } from '~/routes/profile/profile.model'
import {
  BulkDuplicateDataFoundMessage,
  BulkEmailAlreadyExistsMessage,
  BulkUnknownErrorMessage,
  UserNotFoundException
} from '~/routes/user/user.error'
import {
  BulkCreateResType,
  BulkUserData,
  CreateUserOnlyType,
  GetUserResType,
  GetUsersResType,
  UserProfileWithoutTeachingType,
  UserWithProfileRelationType
} from '~/routes/user/user.model'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import { SubjectStatus } from '~/shared/constants/subject.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { UserType } from '~/shared/models/shared-user.model'
import {
  userRoleDepartmentInclude,
  userRoleDepartmentNameInclude,
  userRoleDepartmentProfileInclude,
  userRoleNameInclude
} from '~/shared/prisma-presets/user.prisma-presets'
import { PrismaService } from '~/shared/services/prisma.service'

const mapToUserProfileWithoutTeaching = (user: UserWithProfileRelationType): UserProfileWithoutTeachingType => {
  const { passwordHash: _passwordHash, roleId: _roleId, departmentId: _departmentId, ...safeUser } = user

  return {
    ...safeUser,
    role: user.role,
    department: user.department ?? null,
    trainerProfile: user.trainerProfile ?? null,
    traineeProfile: user.traineeProfile ?? null
  }
}

const withTeachingAssignmentDefaults = (user: UserWithProfileRelationType | null): GetUserResType | null => {
  if (!user) {
    return null
  }

  const baseProfile = mapToUserProfileWithoutTeaching(user)

  if (user.role.name !== RoleName.TRAINER) {
    return baseProfile as GetUserResType
  }

  return {
    ...baseProfile,
    teachingCourses: [],
    teachingSubjects: []
  }
}

@Injectable()
@SerializeAll()
export class UserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async list(): Promise<GetUsersResType> {
    const data = await this.prismaService.user.findMany({
      omit: {
        passwordHash: true,
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

  async create({
    createdById,
    userData,
    roleName,
    trainerProfile,
    traineeProfile
  }: {
    createdById: string | null
    userData: CreateUserOnlyType
    roleName: string
    trainerProfile?: CreateTrainerProfileType
    traineeProfile?: CreateTraineeProfileType
  }): Promise<GetUserResType | null> {
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
            dob: new Date(traineeProfile.dob),
            enrollmentDate: traineeProfile.enrollmentDate ? new Date(traineeProfile.enrollmentDate) : null,
            trainingBatch: traineeProfile.trainingBatch,
            passportNo: traineeProfile.passportNo,
            nation: traineeProfile.nation ?? null,
            createdById
          }
        })
      }

      // Bước 3: Trả về user hoàn chỉnh với profile
      const createdUser = await tx.user.findUnique({
        where: { id: newUser.id },
        include: userRoleDepartmentProfileInclude
      })

      return withTeachingAssignmentDefaults(createdUser)
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
  }): Promise<BulkCreateResType> {
    const results: BulkCreateResType = {
      success: [],
      failed: [],
      summary: {
        total: usersData.length,
        successful: 0,
        failed: 0
      }
    }

    const toFailedUserData = (userData: BulkUserData) => {
      const { roleId, passwordHash, eid, roleName, ...originalUserData } = userData

      return {
        ...originalUserData,
        role: { id: roleId, name: roleName, description: null, isActive: true }
      }
    }

    // Xử lý theo chunks để tránh vấn đề memory và timeout database
    for (let i = 0; i < usersData.length; i += chunkSize) {
      const chunk = usersData.slice(i, i + chunkSize)

      const entries = chunk.map((userData, chunkIndex) => ({
        userData,
        originalIndex: i + chunkIndex
      }))

      if (entries.length === 0) {
        continue
      }

      try {
        const chunkResults = await this.prismaService.$transaction(
          async (tx) => {
            // Lấy danh sách email trong chunk
            const emails = entries.map(({ userData }) => userData.email)

            // Check email đã tồn tại trong DB
            const existingUsers = await tx.user.findMany({
              where: {
                email: { in: emails },
                deletedAt: null
              },
              select: { email: true }
            })

            const existingEmails = new Set(existingUsers.map((u) => u.email))

            const validUsersInChunk: Array<{ userData: BulkUserData; originalIndex: number }> = []
            const duplicateUsersInChunk: Array<{ userData: BulkUserData; originalIndex: number }> = []

            entries.forEach((entry) => {
              if (existingEmails.has(entry.userData.email)) {
                duplicateUsersInChunk.push(entry) // email đã tồn tại trong DB
              } else {
                validUsersInChunk.push(entry) // email chưa tồn tại, được phép tạo
              }
            })

            if (validUsersInChunk.length === 0) {
              return {
                created: [],
                duplicates: duplicateUsersInChunk
              }
            }

            // Chuẩn bị data tạo user
            const usersToCreate = validUsersInChunk.map(({ userData }) => ({
              ...userData,
              createdById,
              trainerProfile: undefined,
              traineeProfile: undefined,
              roleName: undefined
            }))

            const createdUsers = await tx.user.createManyAndReturn({
              data: usersToCreate,
              include: userRoleDepartmentInclude
            })

            const trainerProfiles: any[] = []
            const traineeProfiles: any[] = []

            validUsersInChunk.forEach(({ userData }, index) => {
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

            if (trainerProfiles.length > 0) {
              await tx.trainerProfile.createMany({ data: trainerProfiles })
            }

            if (traineeProfiles.length > 0) {
              await tx.traineeProfile.createMany({ data: traineeProfiles })
            }

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
              }

              if (user.role.name === RoleName.TRAINEE && traineeProfile) {
                return { ...baseUser, traineeProfile }
              }

              return baseUser
            })

            return {
              created: finalUsers,
              duplicates: duplicateUsersInChunk
            }
          },
          { timeout: 30000 }
        )

        // Merge user tạo thành công
        results.success.push(...chunkResults.created)
        results.summary.successful += chunkResults.created.length

        // Merge user trùng email với DB
        chunkResults.duplicates.forEach(({ userData, originalIndex }) => {
          results.failed.push({
            index: originalIndex,
            error: BulkEmailAlreadyExistsMessage(userData.email),
            userData: toFailedUserData(userData)
          })
        })
        results.summary.failed += chunkResults.duplicates.length
      } catch (error) {
        // Transaction lỗi -> coi tất cả entries trong chunk là failed
        entries.forEach(({ userData, originalIndex }) => {
          let errorMessage = BulkUnknownErrorMessage

          if (error instanceof Error) {
            if (error.message.includes('Unique constraint failed on the fields: (`email`)')) {
              errorMessage = BulkEmailAlreadyExistsMessage(userData.email)
            } else if (error.message.includes('Unique constraint failed')) {
              errorMessage = BulkDuplicateDataFoundMessage
            } else {
              errorMessage = error.message
            }
          }

          results.failed.push({
            index: originalIndex,
            error: errorMessage,
            userData: toFailedUserData(userData)
          })
        })
        results.summary.failed += entries.length

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
      userData: Partial<CreateUserOnlyType>
      roleName: string
      trainerProfile?: any
      traineeProfile?: any
    }
  ): Promise<GetUserResType | null> {
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
      const updatedUser = await tx.user.findUnique({
        where: { id },
        include: userRoleDepartmentProfileInclude
      })

      return withTeachingAssignmentDefaults(updatedUser)
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

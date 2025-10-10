import { Injectable } from '@nestjs/common'
import { CreateTraineeProfileType, CreateTrainerProfileType } from '~/routes/profile/profile.model'
import {
  BulkDuplicateDataFoundMessage,
  BulkEmailAlreadyExistsMessage,
  BulkUnknownErrorMessage,
  UserNotFoundException
} from '~/routes/user/user.error'
import { BulkCreateResultType, CreateUserInternalType, GetUsersResType, UserType } from '~/routes/user/user.model'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import { IncludeDeletedQueryType } from '~/shared/models/query.model'
import { PrismaService } from '~/shared/services/prisma.service'

type BulkUserData = CreateUserInternalType & {
  roleName: string
  trainerProfile?: CreateTrainerProfileType
  traineeProfile?: CreateTraineeProfileType
}

@Injectable()
export class UserRepo {
  constructor(private prismaService: PrismaService) {}

  async list({
    includeDeleted = false,
    roleName
  }: IncludeDeletedQueryType & { roleName?: string } = {}): Promise<GetUsersResType> {
    const whereClause: any = includeDeleted ? {} : { deletedAt: null }
    if (roleName) {
      whereClause.role = {
        name: roleName,
        ...(includeDeleted ? {} : { deletedAt: null })
      }
    }

    const [totalItems, data] = await Promise.all([
      this.prismaService.user.count({
        where: whereClause
      }),
      this.prismaService.user.findMany({
        where: whereClause,
        include: {
          role: true,
          department: true
        }
      })
    ])
    return {
      data,
      totalItems
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
  }) {
    return await this.prismaService.$transaction(async (tx) => {
      // Bước 1: Tạo user cơ bản
      const newUser = await tx.user.create({
        data: {
          ...userData,
          createdById
        },
        include: {
          role: {
            select: { name: true }
          },
          department: {
            select: {
              name: true
            }
          }
        }
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
            enrollmentDate: new Date(traineeProfile.enrollmentDate),
            trainingBatch: traineeProfile.trainingBatch,
            passportNo: traineeProfile.passportNo || null,
            nation: traineeProfile.nation,
            createdById
          }
        })
      }

      // Bước 3: Trả về user hoàn chỉnh với profile
      return await tx.user.findUnique({
        where: { id: newUser.id },
        include: {
          role: {
            select: { id: true, name: true }
          },
          department: {
            select: { id: true, name: true }
          },
          trainerProfile: roleName === RoleName.TRAINER,
          traineeProfile: roleName === RoleName.TRAINEE
        }
      })
    })
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
  ) {
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
        include: {
          role: {
            select: { id: true, name: true }
          },
          department: {
            select: { id: true, name: true }
          },
          trainerProfile: roleName === RoleName.TRAINER,
          traineeProfile: roleName === RoleName.TRAINEE
        }
      })
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
        include: {
          role: { select: { name: true } }
        }
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
          role: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          trainerProfile: user.role.name === RoleName.TRAINER,
          traineeProfile: user.role.name === RoleName.TRAINEE
        }
      })
    })
  }

  /**
   * Tạo hàng loạt người dùng với hiệu suất tối ưu
   * Tính năng:
   * - Xử lý theo chunks để tránh vấn đề memory
   * - Insert hàng loạt cho users
   * - Tạo profile riêng biệt để tối ưu hiệu suất
   * - Hỗ trợ transaction với rollback khi có lỗi
   */
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
              include: {
                role: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } }
              }
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
                  enrollmentDate: new Date(userData.traineeProfile.enrollmentDate),
                  trainingBatch: userData.traineeProfile.trainingBatch,
                  passportNo: userData.traineeProfile.passportNo || null,
                  nation: userData.traineeProfile.nation,
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
                role: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
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

  async bulkTraineeLookup(trainees: { eid: string; fullName: string }[]): Promise<any[]> {
    const eids = trainees.map((t) => t.eid)

    // Get all users with TRAINEE role matching the EIDs
    const foundUsers = await this.prismaService.user.findMany({
      where: {
        eid: { in: eids },
        role: {
          name: RoleName.TRAINEE,
          deletedAt: null
        },
        deletedAt: null
      },
      include: {
        role: {
          select: {
            id: true,
            name: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        },
        traineeProfile: true
      }
    })

    // Create a map for quick lookup
    const userMap = new Map(foundUsers.map((user) => [user.eid, user]))

    // Build results for each requested trainee
    const results = trainees.map((trainee) => {
      const foundUser = userMap.get(trainee.eid)
      return {
        eid: trainee.eid,
        fullName: trainee.fullName,
        found: !!foundUser,
        user: foundUser
          ? {
              ...foundUser,
              passwordHash: undefined,
              signatureImageUrl: undefined,
              roleId: undefined,
              departmentId: undefined
            }
          : null
      }
    })

    return results
  }
}

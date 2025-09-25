import { Injectable } from '@nestjs/common'
import { CreateTraineeProfileType, CreateTrainerProfileType } from '~/routes/profile/profile.model'
import { UserNotFoundException } from '~/routes/user/user.error'
import { BulkCreateResultType, CreateUserInternalType, GetUsersResType, UserType } from '~/routes/user/user.model'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'

type BulkUserData = CreateUserInternalType & {
  roleName: string
  trainerProfile?: CreateTrainerProfileType
  traineeProfile?: CreateTraineeProfileType
}

@Injectable()
export class UserRepo {
  constructor(private prismaService: PrismaService) {}

  async list({ includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<GetUsersResType> {
    const whereClause = includeDeleted ? {} : { deletedAt: null }

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

  async create({ createdById, data }: { createdById: string | null; data: CreateUserInternalType }): Promise<UserType> {
    return this.prismaService.user.create({
      data: {
        ...data,
        createdById
      }
    })
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
      // Step 1: Create base user
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

      // Step 2: Create role-specific profile if data provided
      if (roleName === RoleName.TRAINER && trainerProfile) {
        await tx.trainerProfile.create({
          data: {
            userId: newUser.id,
            specialization: trainerProfile.specialization,
            certificationNumber: trainerProfile.certificationNumber,
            yearsOfExp: Number(trainerProfile.yearsOfExp),
            bio: trainerProfile.bio
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
            nation: traineeProfile.nation
          }
        })
      }

      // Step 3: Return complete user with profile
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
      // Update base user if userData provided
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id },
          data: {
            ...userData,
            updatedById
          }
        })
      }

      // Update or create role-specific profile
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

      // Return updated user with profile
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
      //Lấy ra user với role
      const user = await tx.user.findUnique({
        where: { id },
        include: {
          role: { select: { name: true } }
        }
      })
      if (!user) throw UserNotFoundException

      //Enable user
      await tx.user.update({
        where: { id },
        data: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
          deletedById: null,
          updatedById: enabledById
        }
      })
      //Enable các profile tương ứng
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
   * Bulk create users with optimized performance
   * Features:
   * - Chunked processing to avoid memory issues
   * - Batch inserts for users
   * - Separate profile creation for better performance
   * - Transaction support with rollback on errors
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

    // Process in chunks to avoid memory issues and database timeout
    for (let i = 0; i < usersData.length; i += chunkSize) {
      const chunk = usersData.slice(i, i + chunkSize)

      try {
        const chunkResults = await this.prismaService.$transaction(
          async (tx) => {
            // Step 0: Check for existing emails in this chunk
            const emails = chunk.map((userData) => userData.email)
            const existingUsers = await tx.user.findMany({
              where: {
                email: { in: emails },
                deletedAt: null
              },
              select: { email: true }
            })

            const existingEmails = new Set(existingUsers.map((u) => u.email))

            // Separate valid users from duplicates
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

            // If no valid users in this chunk, return empty results
            if (validUsersInChunk.length === 0) {
              return {
                created: [],
                duplicates: duplicateUsersInChunk
              }
            }

            // Step 1: Bulk create only valid users
            const usersToCreate = validUsersInChunk.map((userData) => ({
              ...userData,
              createdById,
              // Remove profile data from user creation
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

            // Step 2: Batch create profiles (separate for performance)
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

            // Batch create profiles
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

            // Step 3: Get complete users with profiles
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
            timeout: 30000 // 30 seconds timeout for large batches
          }
        )

        // Process successful creations
        results.success.push(...chunkResults.created)
        results.summary.successful += chunkResults.created.length

        // Process duplicate emails found before creation
        chunkResults.duplicates.forEach(({ userData, originalIndex }) => {
          // Extract original user data without internal fields
          const { roleId, passwordHash, eid, roleName, ...originalUserData } = userData

          // Reconstruct role object for failed response
          const failedUserData = {
            ...originalUserData,
            role: { id: roleId, name: roleName }
          }

          results.failed.push({
            index: originalIndex,
            error: `Email already exists: ${originalUserData.email}`,
            userData: failedUserData
          })
        })
        results.summary.failed += chunkResults.duplicates.length
      } catch (error) {
        // Handle chunk failure - add all users in this chunk to failed array
        chunk.forEach((userData, index) => {
          // Extract original user data without internal fields
          const { roleId, passwordHash, eid, roleName, ...originalUserData } = userData

          // Reconstruct role object for failed response
          const failedUserData = {
            ...originalUserData,
            role: { id: roleId, name: roleName }
          }

          let errorMessage = 'Unknown error'
          if (error instanceof Error) {
            if (error.message.includes('Unique constraint failed on the fields: (`email`)')) {
              errorMessage = `Email already exists: ${originalUserData.email}`
            } else if (error.message.includes('Unique constraint failed')) {
              errorMessage = 'Duplicate data found'
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
}

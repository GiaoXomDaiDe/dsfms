import { Injectable } from '@nestjs/common'
import { CreateTraineeProfileType, CreateTrainerProfileType } from '~/routes/profile/profile.model'
import { CreateUserInternalType, GetUsersQueryType, GetUsersResType, UserType } from '~/routes/user/user.model'
import { RoleName } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class UserRepo {
  constructor(private prismaService: PrismaService) {}

  async list(pagination: GetUsersQueryType): Promise<GetUsersResType> {
    const skip = (pagination.page - 1) * pagination.limit
    const take = pagination.limit
    const [totalItems, data] = await Promise.all([
      this.prismaService.user.count({
        where: {
          deletedAt: null
        }
      }),
      this.prismaService.user.findMany({
        where: {
          deletedAt: null
        },
        skip,
        take,
        include: {
          role: true,
          department: true
        }
      })
    ])
    return {
      data,
      totalItems,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(totalItems / pagination.limit)
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
    console.log({
      createdById,
      userData,
      roleName,
      trainerProfile,
      traineeProfile
    })
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

  async updateWithProfile({
    id,
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
  }) {
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
      ? this.prismaService.user.delete({
          where: {
            id
          }
        })
      : this.prismaService.user.update({
          where: {
            id,
            deletedAt: null
          },
          data: {
            deletedAt: new Date(),
            deletedById
          }
        })
  }
}

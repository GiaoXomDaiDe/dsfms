import { Injectable } from '@nestjs/common'
import {
  CreateTraineeProfileType,
  CreateTrainerProfileType,
  UpdateTraineeProfileType,
  UpdateTrainerProfileType
} from '~/routes/profile/profile.model'
import { UserNotFoundException } from '~/routes/user/user.error'
import { UpdateUserInternalType, UserType } from '~/routes/user/user.model'
import { RoleName } from '~/shared/constants/auth.constant'
import { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import { EidService } from '~/shared/services/eid.service'

import { PrismaService } from '~/shared/services/prisma.service'

type UserIncludeProfileType = UserType & {
  role: {
    id: string
    name: string
  }
  department: {
    id: string
    name: string
  } | null
} & Partial<{
    trainerProfile: object | null
    traineeProfile: object | null
  }>

export type WhereUniqueUserType = { id: string } | { email: string }
@Injectable()
export class SharedUserRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sharedRoleRepo: SharedRoleRepository,
    private readonly eidService: EidService
  ) {}

  findUnique(where: WhereUniqueUserType): Promise<UserType | null> {
    return this.prismaService.user.findFirst({
      where: {
        ...where,
        deletedAt: null
      }
    })
  }

  async findUniqueIncludeProfile(where: WhereUniqueUserType): Promise<UserIncludeProfileType | null> {
    const user = await this.prismaService.user.findFirst({
      where: {
        ...where,
        deletedAt: null
      },
      include: {
        role: {
          include: {
            permissions: {
              select: {
                method: true,
                id: true,
                description: true,
                isActive: true,
                module: true,
                name: true,
                path: true,
                viewModule: true,
                viewName: true
              }
            }
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        },
        trainerProfile: true,
        traineeProfile: true
      }
    })
    console.log(user, 'user')
    return user
  }
  async findDisableUniqueIncludeProfile(where: WhereUniqueUserType): Promise<UserIncludeProfileType | null> {
    const user = await this.prismaService.user.findFirst({
      where: {
        ...where
      },
      include: {
        role: {
          select: {
            id: true,
            name: true
          },
          include: {
            permissions: {
              select: {
                method: true,
                id: true,
                description: true,
                isActive: true,
                module: true,
                name: true,
                path: true,
                viewModule: true,
                viewName: true
              }
            }
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        },
        trainerProfile: true,
        traineeProfile: true
      }
    })

    return user
  }

  async updateWithProfile(
    where: { id: string },
    {
      updatedById,
      userData,
      newRoleName,
      trainerProfile,
      traineeProfile
    }: {
      updatedById: string
      userData: UpdateUserInternalType
      newRoleName: string
      trainerProfile?: UpdateTrainerProfileType
      traineeProfile?: UpdateTraineeProfileType
    }
  ): Promise<UserIncludeProfileType | null> {
    return this.prismaService.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: where.id, deletedAt: null },
        include: {
          role: {
            select: { id: true, name: true }
          },
          department: {
            select: { id: true, name: true }
          }
        }
      })
      if (!currentUser) throw UserNotFoundException

      const isRoleChanging = newRoleName !== currentUser?.role.name
      console.log('isRoleChanging', isRoleChanging, newRoleName, currentUser?.role.name)
      let needsNewEid = false
      let newEid = currentUser.eid

      if (isRoleChanging) {
        // Always check if current EID matches new role
        if (!this.eidService.isEidMatchingRole(currentUser.eid, newRoleName)) {
          needsNewEid = true
          newEid = (await this.eidService.generateEid({ roleName: newRoleName })) as string
          console.log(
            `EID mismatch: current ${currentUser.eid} doesn't match role ${newRoleName}, generating new: ${newEid}`
          )
        }
      }

      if (isRoleChanging) {
        if (newRoleName === RoleName.TRAINER) {
          // Check if user already has trainer profile
          const existingTrainerProfile = await tx.trainerProfile.findUnique({
            where: { userId: where.id, deletedAt: null }
          })
          console.log('existingTrainerProfile', existingTrainerProfile)

          if (!existingTrainerProfile) {
            // First time becoming trainer - need new EID
            needsNewEid = true
            newEid = (await this.eidService.generateEid({ roleName: newRoleName })) as string
          }
          // If has existing trainer profile, keep the old trainer EID
        } else if (newRoleName === RoleName.TRAINEE) {
          // Check if user already has trainee profile
          const existingTraineeProfile = await tx.traineeProfile.findUnique({
            where: { userId: where.id, deletedAt: null }
          })

          if (!existingTraineeProfile) {
            // First time becoming trainee - need new EID
            needsNewEid = true
            newEid = (await this.eidService.generateEid({ roleName: newRoleName })) as string
          }
          // If has existing trainee profile, keep the old trainee EID
        } else {
          // Other roles (not trainer/trainee) - always generate new EID
          needsNewEid = true
          newEid = (await this.eidService.generateEid({ roleName: newRoleName })) as string
          console.log('newEid for other role', newEid)
        }
      }
      console.log('needsNewEid, newEid', 'id', needsNewEid, newEid, where.id)
      //Bước 1: Cập nhật user base
      const updatedUser = await tx.user.update({
        where: {
          ...where,
          deletedAt: null
        },
        data: {
          ...userData,
          eid: needsNewEid ? newEid : currentUser.eid,
          updatedById
        },
        include: {
          role: {
            select: { id: true, name: true }
          },
          department: {
            select: { id: true, name: true }
          }
        }
      })
      if (!updatedUser) {
        throw UserNotFoundException
      }

      if (isRoleChanging) {
        if (newRoleName === RoleName.TRAINEE) {
          //disable trainer profile if exists
          await tx.trainerProfile.update({
            where: { userId: where.id, deletedAt: null },
            data: { deletedAt: new Date(), updatedById }
          })
          //create trainee profile
          await tx.traineeProfile.upsert({
            where: { userId: where.id },
            create: {
              userId: where.id,
              ...(traineeProfile as CreateTraineeProfileType),
              createdById: updatedById,
              updatedById,
              deletedAt: null
            },
            update: {
              ...traineeProfile,
              updatedById,
              deletedAt: null
            }
          })
        } else if (newRoleName === RoleName.TRAINER) {
          //disable trainee profile if exists
          await tx.traineeProfile.update({
            where: { userId: where.id, deletedAt: null },
            data: { deletedAt: new Date(), updatedById }
          })
          //create trainer profile
          await tx.trainerProfile.upsert({
            where: { userId: where.id },
            create: {
              userId: where.id,
              ...(trainerProfile as CreateTrainerProfileType), // có thể undefined -> tùy DTO default
              createdById: updatedById,
              updatedById,
              deletedAt: null // bật active
            },
            update: {
              ...trainerProfile,
              updatedById,
              deletedAt: null // bật active trở lại
            }
          })
        } else {
          // với trường hợp role khác mà ko có profile thì disable cả 2 profile nếu có
          await tx.trainerProfile.updateMany({
            where: { userId: where.id, deletedAt: null },
            data: { deletedAt: new Date(), updatedById }
          })
          await tx.traineeProfile.updateMany({
            where: { userId: where.id, deletedAt: null },
            data: { deletedAt: new Date(), updatedById }
          })
        }
      }

      // Nếu không đổi role thì chỉ update profile nếu có data truyền vào
      else {
        if (newRoleName === RoleName.TRAINER && trainerProfile) {
          await tx.trainerProfile.upsert({
            where: { userId: where.id },
            create: {
              userId: where.id,
              ...(trainerProfile as CreateTrainerProfileType), // có thể undefined -> tùy DTO default
              createdById: updatedById,
              updatedById,
              deletedAt: null // bật active
            },
            update: {
              ...trainerProfile,
              updatedById,
              deletedAt: null // bật active trở lại
            }
          })
        } else if (newRoleName === RoleName.TRAINEE && traineeProfile) {
          await tx.traineeProfile.upsert({
            where: { userId: where.id },
            create: {
              userId: where.id,
              ...(traineeProfile as CreateTraineeProfileType),
              createdById: updatedById,
              updatedById,
              deletedAt: null
            },
            update: {
              ...traineeProfile,
              updatedById,
              deletedAt: null
            }
          })
        }
      }

      // Step 3: Return complete user with profile
      return await tx.user.findUnique({
        where: { id: where.id },
        include: {
          role: {
            select: { id: true, name: true }
          },
          department: {
            select: { id: true, name: true }
          },
          trainerProfile: newRoleName === RoleName.TRAINER,
          traineeProfile: newRoleName === RoleName.TRAINEE
        }
      })
    })
  }
  async update(where: { id: string }, data: Partial<UserType>): Promise<UserType | null> {
    return this.prismaService.user.update({
      where: {
        ...where,
        deletedAt: null
      },
      data
    })
  }
}

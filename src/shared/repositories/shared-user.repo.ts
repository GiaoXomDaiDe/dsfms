import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  CreateTraineeProfileType,
  CreateTrainerProfileType,
  UpdateTraineeProfileType,
  UpdateTrainerProfileType
} from '~/routes/profile/profile.model'
import { UserNotFoundException } from '~/routes/user/user.error'
import { GetUserProfileResType, UpdateUserInternalType, UserType } from '~/routes/user/user.model'
import { RoleName } from '~/shared/constants/auth.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { IncludeDeletedQueryType } from '~/shared/models/query.model'
import { EidService } from '~/shared/services/eid.service'
import { PrismaService } from '~/shared/services/prisma.service'

export type WhereUniqueUserType = { id: string } | { email: string }
type UserWithRoleAndDepartment = Prisma.UserGetPayload<{
  select: {
    id: true
    eid: true
    firstName: true
    lastName: true
    middleName: true
    address: true
    email: true
    status: true
    gender: true
    phoneNumber: true
    avatarUrl: true
    createdById: true
    updatedById: true
    deletedById: true
    deletedAt: true
    createdAt: true
    updatedAt: true
    role: {
      select: {
        id: true
        name: true
      }
    }
    department: {
      select: {
        id: true
        name: true
      }
    }
  }
}>
type TrainerSummary = Prisma.UserGetPayload<{
  select: {
    id: true
    eid: true
    firstName: true
    lastName: true
    email: true
    departmentId: true
  }
}>
type TraineeIdLookup = Prisma.UserGetPayload<{
  select: {
    id: true
    eid: true
  }
}>
export type AssignmentUserForSubject = Prisma.UserGetPayload<{
  select: {
    id: true
    eid: true
    firstName: true
    lastName: true
    email: true
    deletedAt: true
    role: {
      select: {
        name: true
      }
    }
    department: {
      select: {
        id: true
        name: true
      }
    }
  }
}>
type BasicUserInfoWithDepartment = Prisma.UserGetPayload<{
  select: {
    id: true
    eid: true
    firstName: true
    lastName: true
    email: true
    department: {
      select: {
        id: true
        name: true
      }
    }
  }
}>
@Injectable()
@SerializeAll()
export class SharedUserRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly eidService: EidService
  ) {}

  findUnique(
    where: WhereUniqueUserType,
    { includeDeleted = false }: IncludeDeletedQueryType = {}
  ): Promise<UserType | null> {
    return this.prismaService.user.findFirst({
      where: {
        ...where,
        deletedAt: includeDeleted ? undefined : null
      }
    })
  }
  async findFirstWithRoleAndDepartment(
    where: Prisma.UserWhereInput,
    { includeDeleted = false }: IncludeDeletedQueryType = {}
  ): Promise<UserWithRoleAndDepartment | null> {
    return this.prismaService.user.findFirst({
      where: {
        ...where,
        deletedAt: includeDeleted ? undefined : null
      },
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        middleName: true,
        address: true,
        email: true,
        status: true,
        gender: true,
        phoneNumber: true,
        avatarUrl: true,
        createdById: true,
        updatedById: true,
        deletedById: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: { id: true, name: true }
        },
        department: {
          select: { id: true, name: true }
        }
      }
    })
  }

  async findAvailableTrainersByDepartment(
    departmentId: string,
    excludeUserIds: string[] = []
  ): Promise<TrainerSummary[]> {
    return this.prismaService.user.findMany({
      where: {
        departmentId,
        deletedAt: null,
        role: {
          name: RoleName.TRAINER
        },
        ...(excludeUserIds.length > 0 ? { id: { notIn: excludeUserIds } } : {})
      },
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        email: true,
        departmentId: true
      }
    })
  }

  async findActiveTrainers({ excludeUserIds = [] }: { excludeUserIds?: string[] } = {}): Promise<TrainerSummary[]> {
    return this.prismaService.user.findMany({
      where: {
        deletedAt: null,
        role: {
          name: RoleName.TRAINER
        },
        ...(excludeUserIds.length > 0 ? { id: { notIn: excludeUserIds } } : {})
      },
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        email: true,
        departmentId: true
      }
    })
  }

  async findActiveTraineesByEids(eids: string[]): Promise<TraineeIdLookup[]> {
    if (eids.length === 0) {
      return []
    }

    return this.prismaService.user.findMany({
      where: {
        eid: { in: eids },
        deletedAt: null,
        role: {
          name: RoleName.TRAINEE
        }
      },
      select: {
        id: true,
        eid: true
      }
    })
  }

  async findActiveUsersByEids(eids: string[]): Promise<TraineeIdLookup[]> {
    if (eids.length === 0) {
      return []
    }

    return this.prismaService.user.findMany({
      where: {
        eid: { in: eids },
        deletedAt: null
      },
      select: {
        id: true,
        eid: true
      }
    })
  }

  async findUsersForAssignment(userIds: string[]): Promise<AssignmentUserForSubject[]> {
    if (userIds.length === 0) {
      return []
    }

    return this.prismaService.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        email: true,
        deletedAt: true,
        role: {
          select: {
            name: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async findBasicInfoWithDepartmentById(userId: string): Promise<BasicUserInfoWithDepartment | null> {
    return this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        email: true,
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async findUniqueIncludeProfile(
    where: WhereUniqueUserType,
    { includeDeleted = false }: IncludeDeletedQueryType = {}
  ): Promise<GetUserProfileResType | null> {
    const user = await this.prismaService.user.findFirst({
      where: {
        ...where,
        deletedAt: includeDeleted ? undefined : null
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            isActive: true
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
      traineeProfile,
      includeDeleted = false
    }: {
      updatedById: string
      userData: UpdateUserInternalType
      newRoleName: string
      trainerProfile?: UpdateTrainerProfileType
      traineeProfile?: UpdateTraineeProfileType
      includeDeleted?: boolean
    }
  ): Promise<GetUserProfileResType | null> {
    return this.prismaService.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: {
          id: where.id,
          deletedAt: includeDeleted ? undefined : null
        },
        include: {
          role: { select: { id: true, name: true, description: true, isActive: true } },
          department: { select: { id: true, name: true, isActive: true } },
          trainerProfile: { where: { deletedAt: null } },
          traineeProfile: { where: { deletedAt: null } }
        }
      })
      if (!currentUser) throw UserNotFoundException

      const isRoleChanging = newRoleName !== currentUser?.role.name
      let newEid = currentUser.eid

      if (isRoleChanging) {
        const shouldGenerateNewEid = this.shouldGenerateNewEid(
          currentUser.eid,
          newRoleName,
          currentUser.trainerProfile,
          currentUser.traineeProfile
        )

        if (shouldGenerateNewEid) {
          newEid = (await this.eidService.generateEid({ roleName: newRoleName })) as string
        }
      }

      //Bước 1: Cập nhật user base
      const updatedUser = await tx.user.update({
        where: {
          ...where,
          deletedAt: includeDeleted ? undefined : null
        },
        data: {
          ...userData,
          eid: newEid,
          updatedById
        }
      })
      if (!updatedUser) {
        throw UserNotFoundException
      }
      // Bước 2: Xử lý profiles
      await this.handleProfileUpdates(tx, {
        userId: where.id,
        newRoleName,
        currentRoleName: currentUser.role.name,
        trainerProfile,
        traineeProfile,
        updatedById,
        hasExistingTrainerProfile: !!currentUser.trainerProfile,
        hasExistingTraineeProfile: !!currentUser.traineeProfile
      })

      // Bước 3: Trả về user mới với profile
      return await tx.user.findUnique({
        where: { id: where.id },
        include: {
          role: {
            select: { id: true, name: true, description: true, isActive: true }
          },
          department: {
            select: { id: true, name: true, isActive: true }
          },
          trainerProfile: newRoleName === RoleName.TRAINER,
          traineeProfile: newRoleName === RoleName.TRAINEE
        }
      })
    })
  }

  /**
   * Xác định có cần generate EID mới không
   */
  private shouldGenerateNewEid(
    currentEid: string,
    newRoleName: string,
    existingTrainerProfile: any,
    existingTraineeProfile: any
  ): boolean {
    // Nếu EID hiện tại không match với role mới
    if (!this.eidService.isEidMatchingRole(currentEid, newRoleName)) {
      return true
    }

    // Trường hợp đặc biệt: lần đầu thành trainer/trainee
    if (newRoleName === RoleName.TRAINER && !existingTrainerProfile) {
      return true
    }

    if (newRoleName === RoleName.TRAINEE && !existingTraineeProfile) {
      return true
    }

    return false
  }

  /**
   * Xử lý việc tạo/cập nhật/xóa profiles
   */
  private async handleProfileUpdates(
    tx: any,
    {
      userId,
      newRoleName,
      currentRoleName,
      trainerProfile,
      traineeProfile,
      updatedById,
      hasExistingTrainerProfile,
      hasExistingTraineeProfile
    }: {
      userId: string
      newRoleName: string
      currentRoleName: string
      trainerProfile?: UpdateTrainerProfileType
      traineeProfile?: UpdateTraineeProfileType
      updatedById: string
      hasExistingTrainerProfile: boolean
      hasExistingTraineeProfile: boolean
    }
  ) {
    const isRoleChanging = newRoleName !== currentRoleName

    if (isRoleChanging) {
      // Đổi role: disable profiles không phù hợp, enable profile phù hợp
      if (newRoleName === RoleName.TRAINER) {
        // Disable trainee profile nếu có
        if (hasExistingTraineeProfile) {
          await tx.traineeProfile.updateMany({
            where: { userId, deletedAt: null },
            data: { deletedAt: new Date(), updatedById }
          })
        }

        // Enable/create trainer profile
        await tx.trainerProfile.upsert({
          where: { userId },
          create: {
            userId,
            ...(trainerProfile as CreateTrainerProfileType),
            createdById: updatedById,
            updatedById,
            deletedAt: null
          },
          update: {
            ...trainerProfile,
            updatedById,
            deletedAt: null
          }
        })
      } else if (newRoleName === RoleName.TRAINEE) {
        // Disable trainer profile nếu có
        if (hasExistingTrainerProfile) {
          await tx.trainerProfile.updateMany({
            where: { userId, deletedAt: null },
            data: { deletedAt: new Date(), updatedById }
          })
        }

        // Enable/create trainee profile
        await tx.traineeProfile.upsert({
          where: { userId },
          create: {
            userId,
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
      } else {
        // Role khác: disable tất cả profiles
        if (hasExistingTrainerProfile) {
          await tx.trainerProfile.updateMany({
            where: { userId, deletedAt: null },
            data: { deletedAt: new Date(), updatedById }
          })
        }

        if (hasExistingTraineeProfile) {
          await tx.traineeProfile.updateMany({
            where: { userId, deletedAt: null },
            data: { deletedAt: new Date(), updatedById }
          })
        }
      }
    } else {
      // Không đổi role: chỉ update profile nếu có data
      if (newRoleName === RoleName.TRAINER && trainerProfile) {
        await tx.trainerProfile.upsert({
          where: { userId },
          create: {
            userId,
            ...(trainerProfile as CreateTrainerProfileType),
            createdById: updatedById,
            updatedById,
            deletedAt: null
          },
          update: {
            ...trainerProfile,
            updatedById,
            deletedAt: null
          }
        })
      }

      if (newRoleName === RoleName.TRAINEE && traineeProfile) {
        await tx.traineeProfile.upsert({
          where: { userId },
          create: {
            userId,
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

  /**
   * Tìm department head hiện tại của một department
   * Business rule: Mỗi department chỉ có 1 department head
   * @param departmentId - ID của department cần kiểm tra
   * @param excludeUserId - ID của user cần loại trừ (dùng cho update case)
   * @returns User hoặc null nếu không tìm thấy
   */
  async findDepartmentHeadByDepartment({
    departmentId,
    excludeUserId
  }: {
    departmentId: string
    excludeUserId?: string
  }): Promise<UserType | null> {
    return await this.prismaService.user.findFirst({
      where: {
        departmentId,
        role: {
          name: RoleName.DEPARTMENT_HEAD,
          deletedAt: null
        },
        deletedAt: null,
        ...(excludeUserId && { id: { not: excludeUserId } })
      }
    })
  }
}

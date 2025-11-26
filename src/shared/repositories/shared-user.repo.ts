import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import {
  CreateTraineeProfileType,
  CreateTrainerProfileType,
  UpdateTraineeProfileType,
  UpdateTrainerProfileType
} from '~/routes/profile/profile.model'
import { UserNotFoundException } from '~/routes/user/user.error'
import {
  GetUserWithProfileResType,
  UpdateUserInternalType,
  UserProfileWithoutTeachingType,
  UserWithProfileRelationType
} from '~/routes/user/user.model'
import type { RoleNameType } from '~/shared/constants/auth.constant'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import { CourseStatus } from '~/shared/constants/course.constant'
import { SubjectStatus } from '~/shared/constants/subject.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { IncludeDeletedQueryType } from '~/shared/models/query.model'
import type { DepartmentSummaryType } from '~/shared/models/shared-department.model'
import type { RoleSummaryType } from '~/shared/models/shared-role.model'
import { UserType } from '~/shared/models/shared-user.model'
import {
  departmentSummarySelect,
  roleNameSelect,
  roleSummarySelect,
  userRoleDepartmentProfileInclude
} from '~/shared/prisma-presets/user.prisma-presets'
import { EidService } from '~/shared/services/eid.service'
import { PrismaService } from '~/shared/services/prisma.service'

export type WhereUniqueUserType = { id: string } | { email: string }

type RoleNameOnly = Pick<RoleSummaryType, 'name'>

type UserWithRoleAndDepartment = Omit<UserType, 'passwordHash' | 'roleId' | 'departmentId'> & {
  role: RoleSummaryType
  department: DepartmentSummaryType | null
}

type TrainerSummary = Pick<UserType, 'id' | 'eid' | 'firstName' | 'lastName' | 'email' | 'departmentId'>

type TraineeIdLookup = Pick<UserType, 'id' | 'eid'>

export type AssignmentUserForSubject = Pick<
  UserType,
  'id' | 'eid' | 'firstName' | 'lastName' | 'email' | 'deletedAt'
> & {
  role: RoleNameOnly
  department: DepartmentSummaryType | null
}

type BasicUserInfoWithDepartment = Pick<UserType, 'id' | 'eid' | 'firstName' | 'lastName' | 'email'> & {
  department: DepartmentSummaryType | null
}

const userProfileInclude = userRoleDepartmentProfileInclude

type UserProfilePayload = UserWithProfileRelationType

const mapToUserProfileWithoutTeaching = (user: UserProfilePayload): UserProfileWithoutTeachingType => {
  const { passwordHash: _passwordHash, roleId: _roleId, departmentId: _departmentId, ...publicFields } = user

  return {
    ...publicFields,
    role: user.role,
    department: user.department ?? null,
    trainerProfile: user.trainerProfile ?? null,
    traineeProfile: user.traineeProfile ?? null
  }
}
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
        signatureImageUrl: true,
        phoneNumber: true,
        avatarUrl: true,
        createdById: true,
        updatedById: true,
        deletedById: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        role: {
          select: roleSummarySelect
        },
        department: {
          select: departmentSummarySelect
        }
      }
    }) as Promise<UserWithRoleAndDepartment | null>
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
    }) as Promise<TrainerSummary[]>
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
    }) as Promise<TrainerSummary[]>
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
    }) as Promise<TraineeIdLookup[]>
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
    }) as Promise<TraineeIdLookup[]>
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
          select: roleNameSelect
        },
        department: {
          select: departmentSummarySelect
        }
      }
    }) as Promise<AssignmentUserForSubject[]>
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
          select: departmentSummarySelect
        }
      }
    }) as Promise<BasicUserInfoWithDepartment | null>
  }

  async findUniqueIncludeProfile(id: string): Promise<GetUserWithProfileResType | null> {
    const user = await this.prismaService.user.findFirst({
      where: {
        id
      },
      include: userProfileInclude
    })
    if (!user) {
      return null
    }

    return this.enrichUserProfile(user as UserProfilePayload)
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
      newRoleName: RoleNameType
      trainerProfile?: UpdateTrainerProfileType
      traineeProfile?: UpdateTraineeProfileType
      includeDeleted?: boolean
    }
  ): Promise<GetUserWithProfileResType> {
    return this.prismaService.$transaction(async (tx) => {
      const currentUser = (await tx.user.findUnique({
        where: {
          id: where.id,
          deletedAt: includeDeleted ? undefined : null
        },
        include: userProfileInclude
      })) as UserProfilePayload | null
      if (!currentUser) throw UserNotFoundException

      const hasExistingTrainerProfile = Array.isArray(currentUser.trainerProfile)
        ? currentUser.trainerProfile.length > 0
        : !!currentUser.trainerProfile
      const hasExistingTraineeProfile = Array.isArray(currentUser.traineeProfile)
        ? currentUser.traineeProfile.length > 0
        : !!currentUser.traineeProfile

      const isRoleChanging = newRoleName !== currentUser.role.name
      let newEid = currentUser.eid

      if (isRoleChanging) {
        const shouldGenerateNewEid = this.shouldGenerateNewEid(
          currentUser.eid,
          newRoleName,
          hasExistingTrainerProfile,
          hasExistingTraineeProfile
        )

        if (shouldGenerateNewEid) {
          newEid = (await this.eidService.generateEid({ roleName: newRoleName })) as string
        }
      }

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
      await this.handleProfileUpdates(tx, {
        userId: where.id,
        newRoleName,
        currentRoleName: currentUser.role.name as RoleNameType,
        trainerProfile,
        traineeProfile,
        updatedById,
        hasExistingTrainerProfile,
        hasExistingTraineeProfile
      })

      const refreshedUser = (await tx.user.findUnique({
        where: { id: where.id },
        include: userProfileInclude
      })) as UserProfilePayload | null

      if (!refreshedUser) {
        throw UserNotFoundException
      }

      return this.enrichUserProfile(refreshedUser)
    })
  }
  private shouldGenerateNewEid(
    currentEid: string,
    newRoleName: RoleNameType,
    hasTrainerProfile: boolean,
    hasTraineeProfile: boolean
  ): boolean {
    if (!this.eidService.isEidMatchingRole(currentEid, newRoleName)) {
      return true
    }

    if (newRoleName === RoleName.TRAINER && !hasTrainerProfile) {
      return true
    }

    if (newRoleName === RoleName.TRAINEE && !hasTraineeProfile) {
      return true
    }

    return false
  }

  private async handleProfileUpdates(
    tx: Prisma.TransactionClient,
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
      newRoleName: RoleNameType
      currentRoleName: RoleNameType
      trainerProfile?: UpdateTrainerProfileType
      traineeProfile?: UpdateTraineeProfileType
      updatedById: string
      hasExistingTrainerProfile: boolean
      hasExistingTraineeProfile: boolean
    }
  ): Promise<void> {
    const isRoleChanging = newRoleName !== currentRoleName

    if (isRoleChanging) {
      if (newRoleName === RoleName.TRAINER) {
        if (hasExistingTraineeProfile) {
          await this.softDeleteTraineeProfile(tx, userId, updatedById)
        }

        await this.upsertTrainerProfile(tx, {
          userId,
          updatedById,
          trainerProfile
        })
        return
      }

      if (newRoleName === RoleName.TRAINEE) {
        if (hasExistingTrainerProfile) {
          await this.softDeleteTrainerProfile(tx, userId, updatedById)
        }

        await this.upsertTraineeProfile(tx, {
          userId,
          updatedById,
          traineeProfile
        })
        return
      }

      if (hasExistingTrainerProfile) {
        await this.softDeleteTrainerProfile(tx, userId, updatedById)
      }

      if (hasExistingTraineeProfile) {
        await this.softDeleteTraineeProfile(tx, userId, updatedById)
      }

      return
    }

    if (newRoleName === RoleName.TRAINER && trainerProfile) {
      await this.upsertTrainerProfile(tx, {
        userId,
        updatedById,
        trainerProfile
      })
    }

    if (newRoleName === RoleName.TRAINEE && traineeProfile) {
      await this.upsertTraineeProfile(tx, {
        userId,
        updatedById,
        traineeProfile
      })
    }
  }

  async update(where: { id: string }, data: Partial<UserType>): Promise<UserType> {
    return this.prismaService.user.update({
      where: {
        ...where,
        deletedAt: null
      },
      data
    })
  }

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
          deletedAt: null,
          isActive: true
        },
        deletedAt: null,
        ...(excludeUserId && { id: { not: excludeUserId } })
      }
    })
  }

  private async upsertTrainerProfile(
    tx: Prisma.TransactionClient,
    {
      userId,
      updatedById,
      trainerProfile
    }: {
      userId: string
      updatedById: string
      trainerProfile?: UpdateTrainerProfileType
    }
  ): Promise<void> {
    if (this.hasProfilePayload(trainerProfile)) {
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
      return
    }

    await tx.trainerProfile.updateMany({
      where: { userId },
      data: { deletedAt: null, updatedById }
    })
  }

  private async upsertTraineeProfile(
    tx: Prisma.TransactionClient,
    {
      userId,
      updatedById,
      traineeProfile
    }: {
      userId: string
      updatedById: string
      traineeProfile?: UpdateTraineeProfileType
    }
  ): Promise<void> {
    if (this.hasProfilePayload(traineeProfile)) {
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
      return
    }

    await tx.traineeProfile.updateMany({
      where: { userId },
      data: { deletedAt: null, updatedById }
    })
  }

  private async softDeleteTrainerProfile(
    tx: Prisma.TransactionClient,
    userId: string,
    updatedById: string
  ): Promise<void> {
    await tx.trainerProfile.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById }
    })
  }

  private async softDeleteTraineeProfile(
    tx: Prisma.TransactionClient,
    userId: string,
    updatedById: string
  ): Promise<void> {
    await tx.traineeProfile.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date(), updatedById }
    })
  }

  private hasProfilePayload<T extends Record<string, unknown> | undefined>(payload?: T): payload is T {
    return !!payload && Object.keys(payload).length > 0
  }

  private async enrichUserProfile(user: UserProfilePayload): Promise<GetUserWithProfileResType> {
    const teachingAssignments = await this.buildTeachingAssignments(user)
    const baseProfile = mapToUserProfileWithoutTeaching(user)
    return {
      ...baseProfile,
      teachingCourses: teachingAssignments.teachingCourses,
      teachingSubjects: teachingAssignments.teachingSubjects
    }
  }

  private async buildTeachingAssignments(
    user: UserProfilePayload
  ): Promise<Pick<GetUserWithProfileResType, 'teachingCourses' | 'teachingSubjects'>> {
    if (user.role.name !== RoleName.TRAINER) {
      return {
        teachingCourses: [],
        teachingSubjects: []
      }
    }

    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      return {
        teachingCourses: [],
        teachingSubjects: []
      }
    }

    const [courseAssignments, subjectAssignments] = await Promise.all([
      this.prismaService.courseInstructor.findMany({
        where: {
          trainerUserId: user.id,
          course: {
            deletedAt: null,
            status: {
              not: CourseStatus.ARCHIVED
            }
          }
        },
        select: {
          roleInAssessment: true,
          course: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              startDate: true,
              endDate: true
            }
          }
        }
      }),
      this.prismaService.subjectInstructor.findMany({
        where: {
          trainerUserId: user.id,
          subject: {
            deletedAt: null,
            status: {
              not: SubjectStatus.ARCHIVED
            }
          }
        },
        select: {
          roleInAssessment: true,
          subject: {
            select: {
              id: true,
              courseId: true,
              code: true,
              name: true,
              status: true,
              startDate: true,
              endDate: true
            }
          }
        }
      })
    ])

    const teachingCourses = courseAssignments
      .flatMap((assignment) => {
        if (!assignment.course) {
          return []
        }

        return [
          {
            id: assignment.course.id,
            code: assignment.course.code,
            name: assignment.course.name,
            status: assignment.course.status,
            startDate: assignment.course.startDate,
            endDate: assignment.course.endDate,
            role: assignment.roleInAssessment
          }
        ]
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

    const teachingSubjects = subjectAssignments
      .flatMap((assignment) => {
        if (!assignment.subject) {
          return []
        }

        return [
          {
            id: assignment.subject.id,
            courseId: assignment.subject.courseId,
            code: assignment.subject.code,
            name: assignment.subject.name,
            status: assignment.subject.status,
            startDate: assignment.subject.startDate,
            endDate: assignment.subject.endDate,
            role: assignment.roleInAssessment
          }
        ]
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

    return {
      teachingCourses,
      teachingSubjects
    }
  }
}

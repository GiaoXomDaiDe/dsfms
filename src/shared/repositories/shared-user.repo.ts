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
  GetUserResType,
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
} from '~/shared/prisma-presets/shared-user.prisma-presets'
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

type UserProfilePayload = UserWithProfileRelationType

// Map entity user (đã include role/department/profile) sang DTO profile
// nhưng chưa có teachingCourses/teachingSubjects.
// Đồng thời loại bỏ các field nhạy cảm (passwordHash, roleId, departmentId).
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
  //done
  async findUniqueIncludeProfile(id: string): Promise<GetUserResType | null> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id
      },
      include: userRoleDepartmentProfileInclude
    })
    if (!user) return null
    // user đã include role/department/profile ở trên bổ sung thêm teachingCourses/teachingSubjects
    return this.buildUserProfileWithTeaching(user)
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
  ): Promise<GetUserResType> {
    return this.prismaService.$transaction(async (tx: Prisma.TransactionClient) => {
      // baseWhere:
      // - Nếu includeDeleted = false: chỉ thao tác với user đang ACTIVE, chưa bị deleted
      // - Nếu includeDeleted = true: cho phép thao tác với cả user đã bị soft-delete
      const baseWhere = includeDeleted ? { id: where.id } : { id: where.id, deletedAt: null, status: UserStatus.ACTIVE }

      // 1) Lấy thông tin user hiện tại (kèm role, department, profile) trong transaction
      const currentUser = await this.loadCurrentUserForUpdate(tx, baseWhere)

      // 2) Xác định user hiện tại đang có trainerProfile / traineeProfile hay không
      const profileFlags = this.getExistingProfileFlags(currentUser)

      // 3) Nếu có đổi role, quyết định có cần sinh EID mới hay giữ nguyên EID cũ
      const newEid = await this.computeNewEidIfNeeded(currentUser, newRoleName, profileFlags)

      // 4) Cập nhật bản ghi user (thông tin cơ bản + EID + updatedById)
      const updatedUser = await tx.user.update({
        where: baseWhere,
        data: {
          ...userData,
          eid: newEid,
          updatedById
        }
      })
      if (!updatedUser) {
        // Trường hợp cực hiếm: update không trả về user -> xem như không tìm thấy user
        throw UserNotFoundException
      }

      // 5) Cập nhật / tạo mới / xoá trainerProfile / traineeProfile
      //    tuỳ theo role mới và trạng thái profile hiện tại
      await this.handleProfileUpdates(tx, {
        userId: where.id,
        newRoleName,
        currentRoleName: currentUser.role.name as RoleNameType,
        trainerProfile,
        traineeProfile,
        updatedById,
        hasExistingTrainerProfile: profileFlags.hasTrainer,
        hasExistingTraineeProfile: profileFlags.hasTrainee
      })

      // 6) Load lại user sau khi update, kèm đầy đủ role/department/profile để trả về cho service
      const refreshedUser = await this.reloadUserWithProfile(tx, where.id)

      // 7) Build lại dữ liệu user theo format cuối cùng (bao gồm thông tin teaching nếu có)
      return this.buildUserProfileWithTeaching(refreshedUser)
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
      await this.handleRoleChangeProfileUpdates(tx, {
        userId,
        newRoleName,
        updatedById,
        trainerProfile,
        traineeProfile,
        hasExistingTrainerProfile,
        hasExistingTraineeProfile
      })
      return
    }

    // Không đổi role, chỉ update nội dung profile nếu có payload
    if (newRoleName === RoleName.TRAINER && trainerProfile) {
      await this.upsertTrainerProfile(tx, { userId, updatedById, trainerProfile })
    }

    if (newRoleName === RoleName.TRAINEE && traineeProfile) {
      await this.upsertTraineeProfile(tx, { userId, updatedById, traineeProfile })
    }
  }

  private async handleRoleChangeProfileUpdates(
    tx: Prisma.TransactionClient,
    {
      userId,
      newRoleName,
      updatedById,
      trainerProfile,
      traineeProfile,
      hasExistingTrainerProfile,
      hasExistingTraineeProfile
    }: {
      userId: string
      newRoleName: RoleNameType
      updatedById: string
      trainerProfile?: UpdateTrainerProfileType
      traineeProfile?: UpdateTraineeProfileType
      hasExistingTrainerProfile: boolean
      hasExistingTraineeProfile: boolean
    }
  ): Promise<void> {
    if (newRoleName === RoleName.TRAINER) {
      if (hasExistingTraineeProfile) {
        await this.softDeleteTraineeProfile(tx, userId, updatedById)
      }

      await this.upsertTrainerProfile(tx, { userId, updatedById, trainerProfile })
      return
    }

    if (newRoleName === RoleName.TRAINEE) {
      if (hasExistingTrainerProfile) {
        await this.softDeleteTrainerProfile(tx, userId, updatedById)
      }

      await this.upsertTraineeProfile(tx, { userId, updatedById, traineeProfile })
      return
    }

    // Role mới KHÔNG phải TRAINER/TRAINEE:
    // -> soft delete mọi profile trainer/trainee hiện có
    if (hasExistingTrainerProfile) {
      await this.softDeleteTrainerProfile(tx, userId, updatedById)
    }

    if (hasExistingTraineeProfile) {
      await this.softDeleteTraineeProfile(tx, userId, updatedById)
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
  /**
   * Tạo DTO user profile đầy đủ (bao gồm teachingCourses/teachingSubjects)
   * từ dữ liệu user đã include quan hệ, đồng thời ẩn profile không phù hợp theo role.
   */
  private async buildUserProfileWithTeaching(user: UserProfilePayload): Promise<GetUserResType> {
    const baseProfile = mapToUserProfileWithoutTeaching(user)
    const teachingAssignments = await this.buildTeachingAssignments(user)

    const fullProfile: GetUserResType = {
      ...baseProfile,
      teachingCourses: teachingAssignments?.teachingCourses ?? [],
      teachingSubjects: teachingAssignments?.teachingSubjects ?? []
    }

    return this.formatUserProfileForRole(fullProfile)
  }

  /**
   * Teaching assignments chỉ áp dụng cho TRAINER active:
   * - Role khác: luôn trả []
   * - TRAINER inactive / deleted: luôn trả []
   */
  private async buildTeachingAssignments(
    user: UserProfilePayload
  ): Promise<Pick<GetUserResType, 'teachingCourses' | 'teachingSubjects'> | null> {
    const isActiveTrainer = user.role.name === RoleName.TRAINER && user.status === UserStatus.ACTIVE && !user.deletedAt

    if (!isActiveTrainer) {
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
            status: { not: CourseStatus.ARCHIVED }
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
            status: { not: SubjectStatus.ARCHIVED }
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
      .flatMap((assignment) =>
        assignment.course
          ? [
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
          : []
      )
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

    const teachingSubjects = subjectAssignments
      .flatMap((assignment) =>
        assignment.subject
          ? [
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
          : []
      )
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

    return {
      teachingCourses,
      teachingSubjects
    }
  }

  /**
   * Ẩn bớt trainerProfile / traineeProfile không phù hợp với role.
   * - Nếu role là TRAINER: chỉ trả về trainerProfile (ẩn traineeProfile nếu có).
   * - Nếu role là TRAINEE: chỉ trả về traineeProfile (ẩn trainerProfile nếu có).
   * - Các role khác: không trả về bất kỳ profile nào.
   */
  private formatUserProfileForRole(user: GetUserResType): GetUserResType {
    const { trainerProfile, traineeProfile, ...baseUser } = user
    const roleName = user.role.name

    if (roleName === RoleName.TRAINER && trainerProfile) {
      return { ...baseUser, trainerProfile }
    }

    if (roleName === RoleName.TRAINEE && traineeProfile) {
      return { ...baseUser, traineeProfile }
    }

    return { ...baseUser }
  }

  /**
   * Lấy user hiện tại để chuẩn bị update:
   * - Luôn include role, department, trainerProfile, traineeProfile.
   * - Ném UserNotFoundException nếu không tìm thấy user (theo điều kiện where đã filter sẵn).
   */
  private async loadCurrentUserForUpdate(
    tx: Prisma.TransactionClient,
    where: { id: string; deletedAt?: null; status?: 'ACTIVE' }
  ): Promise<UserProfilePayload> {
    const currentUser = (await tx.user.findUnique({
      where,
      include: userRoleDepartmentProfileInclude
    })) as UserProfilePayload | null

    if (!currentUser) throw UserNotFoundException
    return currentUser
  }

  /**
   * Tính toán xem user hiện tại đang có trainerProfile / traineeProfile hay không.
   * Hỗ trợ cả trường hợp quan hệ 1-1 và 1-n (array).
   */
  private getExistingProfileFlags(currentUser: UserProfilePayload): {
    hasTrainer: boolean
    hasTrainee: boolean
  } {
    const hasTrainer = Array.isArray(currentUser.trainerProfile)
      ? currentUser.trainerProfile.length > 0
      : !!currentUser.trainerProfile

    const hasTrainee = Array.isArray(currentUser.traineeProfile)
      ? currentUser.traineeProfile.length > 0
      : !!currentUser.traineeProfile

    return { hasTrainer, hasTrainee }
  }

  /**
   * Quyết định EID cuối cùng sau khi update:
   * - Nếu role không đổi -> giữ nguyên EID hiện tại.
   * - Nếu role đổi:
   *   - Gọi shouldGenerateNewEid(...) để xem có cần sinh EID mới không.
   *   - Nếu cần -> sinh EID mới theo role mới.
   *   - Nếu không cần -> giữ EID cũ.
   */
  private async computeNewEidIfNeeded(
    currentUser: UserProfilePayload,
    newRoleName: RoleNameType,
    flags: { hasTrainer: boolean; hasTrainee: boolean }
  ): Promise<string> {
    const isRoleChanging = newRoleName !== currentUser.role.name
    if (!isRoleChanging) return currentUser.eid

    const shouldGenerateNewEid = this.shouldGenerateNewEid(
      currentUser.eid,
      newRoleName,
      flags.hasTrainer,
      flags.hasTrainee
    )

    if (!shouldGenerateNewEid) return currentUser.eid

    return (await this.eidService.generateEid({ roleName: newRoleName })) as string
  }

  /**
   * Sau khi cập nhật xong user + profile, load lại user (kèm role/department/profile)
   * để đảm bảo dữ liệu trả về là phiên bản mới nhất trong DB.
   */
  private async reloadUserWithProfile(tx: Prisma.TransactionClient, id: string): Promise<UserProfilePayload> {
    const refreshedUser = (await tx.user.findUnique({
      where: { id },
      include: userRoleDepartmentProfileInclude
    })) as UserProfilePayload | null

    if (!refreshedUser) throw UserNotFoundException
    return refreshedUser
  }
}

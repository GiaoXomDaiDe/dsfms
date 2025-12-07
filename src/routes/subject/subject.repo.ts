import { Injectable } from '@nestjs/common'
import { CourseStatus, Prisma } from '@prisma/client'
import { map } from 'lodash'
import { CourseEnrollmentBatchSummaryType } from '~/routes/course/course.model'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import {
  SubjectEnrollmentStatus,
  SubjectEnrollmentStatusValue,
  SubjectInstructorRoleValue,
  SubjectMethodValue,
  SubjectStatus,
  SubjectStatusValue,
  SubjectTypeValue
} from '~/shared/constants/subject.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { SubjectType } from '~/shared/models/shared-subject.model'
import {
  subjectAssignmentSummarySelect,
  subjectCourseDetailSelect,
  subjectListCountInclude
} from '~/shared/prisma-presets/shared-subject.prisma-presets'
import {
  userEidOnlySelect,
  userTraineeBasicStatusSelect,
  userTraineeDirectorySelect,
  userTraineeWithDepartmentSelect,
  userTrainerContactSelect,
  userTrainerDirectorySelect,
  userTrainerWithDepartmentSelect
} from '~/shared/prisma-presets/shared-user.prisma-presets'
import { AssignmentUserForSubject, SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  CannotArchiveSubjectWithNonCancelledEnrollmentsException,
  CourseNotFoundException,
  SubjectNotFoundException,
  TraineeNotFoundException,
  TraineeResolutionFailureException,
  TrainerNotFoundException
} from './subject.error'
import {
  AssignTrainerResType,
  CreateSubjectBodyType,
  GetActiveTraineesResType,
  GetAvailableTrainersResType,
  GetSubjectDetailResType,
  GetSubjectsQueryType,
  GetSubjectsResType,
  GetSubjectsType,
  GetTraineeCourseSubjectsResType,
  LookupTraineesBodyType,
  LookupTraineesResType,
  SubjectDetailCourseType,
  SubjectDetailEnrollmentsByBatchType,
  SubjectDetailInstructorType,
  TraineeAssignmentDuplicateType,
  TraineeAssignmentIssueType,
  TraineeAssignmentUserType,
  TraineeCourseSubjectsItemType,
  TraineeEnrollmentRecordType,
  TraineeEnrollmentUserType,
  UpdateSubjectBodyType,
  UpdateTrainerAssignmentResType
} from './subject.model'

type AssignTraineesResult = {
  enrolled: TraineeAssignmentUserType[]
  duplicates: TraineeAssignmentDuplicateType[]
  invalid: TraineeAssignmentIssueType[]
}

type AssignmentUserSummary = Pick<
  AssignmentUserForSubject,
  'id' | 'eid' | 'firstName' | 'lastName' | 'email' | 'department'
>

@Injectable()
@SerializeAll()
export class SubjectRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sharedUserRepo: SharedUserRepository
  ) {}

  async list(query: GetSubjectsQueryType): Promise<GetSubjectsResType> {
    const { method, type, isSIM, courseId, status } = query

    const where: Prisma.SubjectWhereInput = {
      // Các bộ lọc nghiệp vụ
      ...(courseId && { courseId: courseId }),
      ...(method && { method: method as SubjectMethodValue }),
      ...(isSIM !== undefined && { isSIM: isSIM }),
      ...(type && { type: type as SubjectTypeValue }),
      deletedAt: null,
      // Lọc status - nếu user chọn ARCHIVED thì hiện ARCHIVED
      // Nếu không truyền status và includeDeleted = false thì mặc định ẩn ARCHIVED
      ...(status ? { status: status as SubjectStatusValue } : { status: { not: SubjectStatus.ARCHIVED } })
    }

    const subjects = await this.prisma.subject.findMany({
      where,
      include: subjectListCountInclude
    })

    const transformedSubjects = subjects.map((subject) => {
      const { _count, ...subjectWithoutCount } = subject
      return {
        ...subjectWithoutCount,
        instructorCount: _count.instructors,
        enrollmentCount: _count.enrollments
      }
    }) as GetSubjectsType[]

    return {
      subjects: transformedSubjects,
      totalItems: transformedSubjects.length
    }
  }

  async findById(id: string): Promise<GetSubjectDetailResType | null> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id,
        deletedAt: null,
        status: { not: SubjectStatus.ARCHIVED }
      },
      include: {
        course: {
          select: subjectCourseDetailSelect
        },
        instructors: {
          include: {
            trainer: {
              select: userTrainerContactSelect
            }
          },
          where: {
            trainer: {
              deletedAt: null,
              status: UserStatus.ACTIVE
            }
          }
        },
        enrollments: {
          include: {
            trainee: {
              select: userTraineeBasicStatusSelect
            }
          },
          where: {
            trainee: {
              deletedAt: null,
              status: UserStatus.ACTIVE
            }
          }
        }
      }
    })

    if (!subject) return null

    // 1) Map instructors
    const instructors: SubjectDetailInstructorType[] = subject.instructors
      .filter((i) => i.trainer) // phòng trường hợp trainer null
      .map((i) => {
        const t = i.trainer
        return {
          id: t.id,
          eid: t.eid,
          firstName: t.firstName,
          middleName: t.middleName ?? '',
          lastName: t.lastName,
          email: t.email,
          phoneNumber: t.phoneNumber,
          status: t.status,
          roleInSubject: i.roleInAssessment
        }
      })

    // 2) Group enrollments theo batchCode
    const enrollmentsByBatchMap = new Map<string, SubjectDetailEnrollmentsByBatchType>()

    for (const enrollment of subject.enrollments) {
      const trainee = enrollment.trainee
      if (!trainee) continue

      const batchCode = enrollment.batchCode
      if (!batchCode) continue

      let batch = enrollmentsByBatchMap.get(batchCode)
      if (!batch) {
        batch = { batchCode, trainees: [] }
        enrollmentsByBatchMap.set(batchCode, batch)
      }

      batch.trainees.push({
        id: trainee.id,
        eid: trainee.eid,
        firstName: trainee.firstName,
        middleName: trainee.middleName,
        lastName: trainee.lastName,
        status: trainee.status,
        enrollmentDate: enrollment.enrollmentDate,
        enrollmentStatus: enrollment.status
      })
    }

    const enrollmentsByBatch = Array.from(enrollmentsByBatchMap.values())

    // 3) Map course
    const course: SubjectDetailCourseType = subject.course
      ? {
          id: subject.course.id,
          name: subject.course.name,
          code: subject.course.code,
          status: subject.course.status,
          department: {
            id: subject.course.department.id,
            name: subject.course.department.name,
            code: subject.course.department.code,
            isActive: subject.course.department.isActive
          }
        }
      : null

    // 4) Bỏ field thừa rồi trả kết quả
    const { courseId, createdById, updatedById, enrollments, ...subjectWithoutRedundant } = subject

    return {
      ...subjectWithoutRedundant,
      course,
      instructors,
      enrollmentsByBatch
    }
  }

  async findActiveTrainers(): Promise<GetAvailableTrainersResType> {
    const trainers = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: {
          not: UserStatus.DISABLED
        },
        role: {
          name: RoleName.TRAINER
        }
      },
      select: userTrainerDirectorySelect,
      orderBy: {
        eid: 'asc'
      }
    })

    return { trainers, totalCount: trainers.length }
  }

  async findActiveTrainees({ subjectIds }: { subjectIds?: string[] }): Promise<GetActiveTraineesResType> {
    let conflictingUserIds: string[] = []

    if (subjectIds && subjectIds.length > 0) {
      const blockingStatuses: SubjectEnrollmentStatusValue[] = [
        SubjectEnrollmentStatus.ENROLLED,
        SubjectEnrollmentStatus.ON_GOING
      ]

      const conflicts = await this.prisma.subjectEnrollment.findMany({
        where: {
          subjectId: { in: subjectIds },
          status: { in: blockingStatuses }
        },
        select: {
          traineeUserId: true
        },
        distinct: ['traineeUserId']
      })

      conflictingUserIds = conflicts.map((conflict) => conflict.traineeUserId).filter((id): id is string => Boolean(id))
    }

    const trainees = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        role: {
          name: RoleName.TRAINEE
        },
        ...(conflictingUserIds.length > 0 && {
          id: {
            notIn: conflictingUserIds
          }
        })
      },
      select: userTraineeDirectorySelect,
      orderBy: {
        eid: 'asc'
      }
    })

    return {
      trainees,
      totalItems: trainees.length
    }
  }

  async create({
    data,
    createdById
  }: {
    data: CreateSubjectBodyType & { duration?: number }
    createdById: string
  }): Promise<SubjectType> {
    const subject = await this.prisma.subject.create({
      data: {
        ...data,
        createdById,
        updatedById: createdById
      }
    })

    return subject
  }

  async update({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateSubjectBodyType & { duration?: number }
    updatedById: string
  }): Promise<SubjectType> {
    const subject = await this.prisma.subject.update({
      where: { id },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      }
    })

    return subject
  }

  async archive({
    id,
    archivedById,
    status
  }: {
    id: string
    archivedById: string
    status: string
  }): Promise<SubjectType> {
    const now = new Date()

    if (status === SubjectStatus.PLANNED) {
      return await this.prisma.$transaction(async (tx) => {
        await tx.subjectEnrollment.updateMany({
          where: {
            subjectId: id,
            status: {
              not: SubjectEnrollmentStatus.CANCELLED
            }
          },
          data: {
            status: SubjectEnrollmentStatus.CANCELLED,
            updatedAt: now
          }
        })

        return tx.subject.update({
          where: { id },
          data: {
            status: SubjectStatus.ARCHIVED,
            deletedAt: now,
            deletedById: archivedById,
            updatedAt: now,
            updatedById: archivedById
          }
        })
      })
    }

    if (status === SubjectStatus.ON_GOING) {
      return await this.prisma.$transaction(async (tx) => {
        const activeEnrollmentCount = await tx.subjectEnrollment.count({
          where: {
            subjectId: id,
            status: {
              not: SubjectEnrollmentStatus.CANCELLED
            }
          }
        })

        if (activeEnrollmentCount > 0) {
          throw CannotArchiveSubjectWithNonCancelledEnrollmentsException
        }

        return tx.subject.update({
          where: { id },
          data: {
            status: SubjectStatus.ARCHIVED,
            deletedAt: now,
            deletedById: archivedById,
            updatedAt: now,
            updatedById: archivedById
          }
        })
      })
    }

    return this.prisma.subject.update({
      where: { id },
      data: {
        status: SubjectStatus.ARCHIVED,
        deletedAt: now,
        deletedById: archivedById,
        updatedAt: now,
        updatedById: archivedById
      }
    })
  }

  async assignTrainerToSubject({
    subjectId,
    trainerUserId,
    roleInSubject
  }: {
    subjectId: string
    trainerUserId: string
    roleInSubject: SubjectInstructorRoleValue
  }): Promise<AssignTrainerResType> {
    return await this.prisma.$transaction(async (tx) => {
      const subject = await tx.subject.findFirst({
        where: {
          id: subjectId,
          deletedAt: null
        },
        select: {
          id: true,
          course: {
            select: {
              id: true,
              departmentId: true
            }
          }
        }
      })

      if (!subject) {
        throw SubjectNotFoundException
      }

      if (!subject.course || !subject.course.departmentId) {
        throw CourseNotFoundException
      }

      const trainer = await tx.user.findUnique({
        where: { id: trainerUserId, deletedAt: null, role: { name: RoleName.TRAINER } },
        select: {
          id: true,
          departmentId: true,
          deletedAt: true,
          role: {
            select: {
              name: true
            }
          }
        }
      })

      if (!trainer || trainer.deletedAt !== null || trainer.role?.name !== RoleName.TRAINER) {
        throw TrainerNotFoundException
      }

      const assignment = await tx.subjectInstructor.create({
        data: {
          subjectId,
          trainerUserId,
          roleInAssessment: roleInSubject
        },
        include: {
          subject: {
            select: subjectAssignmentSummarySelect
          },
          trainer: {
            select: userTrainerWithDepartmentSelect
          }
        }
      })

      if (!assignment.subject) {
        throw SubjectNotFoundException
      }

      return {
        trainer: {
          id: assignment.trainer.id,
          eid: assignment.trainer.eid,
          firstName: assignment.trainer.firstName,
          middleName: assignment.trainer.middleName,
          lastName: assignment.trainer.lastName,
          email: assignment.trainer.email,
          phoneNumber: assignment.trainer.phoneNumber,
          status: assignment.trainer.status
        },
        subject: {
          id: assignment.subject.id,
          code: assignment.subject.code,
          name: assignment.subject.name,
          status: assignment.subject.status,
          startDate: assignment.subject.startDate,
          endDate: assignment.subject.endDate
        },
        role: assignment.roleInAssessment
      }
    })
  }

  async updateTrainerAssignment({
    currentSubjectId,
    currentTrainerId,
    newRoleInSubject
  }: {
    currentSubjectId: string
    currentTrainerId: string
    newRoleInSubject: SubjectInstructorRoleValue
  }): Promise<UpdateTrainerAssignmentResType> {
    await this.prisma.subjectInstructor.delete({
      where: {
        trainerUserId_subjectId: {
          trainerUserId: currentTrainerId,
          subjectId: currentSubjectId
        }
      }
    })

    return await this.assignTrainerToSubject({
      subjectId: currentSubjectId,
      trainerUserId: currentTrainerId,
      roleInSubject: newRoleInSubject
    })
  }

  async removeTrainerFromSubject({
    subjectId,
    trainerUserId
  }: {
    subjectId: string
    trainerUserId: string
  }): Promise<void> {
    await this.prisma.subjectInstructor.delete({
      where: {
        trainerUserId_subjectId: {
          trainerUserId,
          subjectId
        }
      }
    })
  }

  async lookupTrainees({
    trainees
  }: {
    trainees: LookupTraineesBodyType['traineesList']
  }): Promise<LookupTraineesResType> {
    const foundUsers: LookupTraineesResType['foundUsers'] = []
    const notFoundIdentifiers: LookupTraineesResType['notFoundIdentifiers'] = []

    for (const trainee of trainees) {
      const where: Prisma.UserWhereInput = {
        deletedAt: null,
        status: { not: UserStatus.DISABLED },
        role: {
          name: RoleName.TRAINEE
        }
      }

      where.eid = trainee.eid
      where.email = trainee.email

      const found = await this.sharedUserRepo.findFirstWithRoleAndDepartment(where)

      if (found) {
        foundUsers.push(found)
      } else {
        notFoundIdentifiers.push(trainee)
      }
    }

    return { foundUsers, notFoundIdentifiers }
  }
  async assignTraineesToSubject({
    subjectId,
    traineeUserIds,
    batchCode,
    blockingStatuses = [SubjectEnrollmentStatus.ENROLLED, SubjectEnrollmentStatus.ON_GOING]
  }: {
    subjectId: string
    traineeUserIds: string[]
    batchCode: string
    blockingStatuses?: SubjectEnrollmentStatusValue[]
  }): Promise<AssignTraineesResult> {
    const requestedUsers = await this.sharedUserRepo.findUsersForAssignment(traineeUserIds)

    const requestedUserMap = new Map<string, AssignmentUserForSubject>(requestedUsers.map((user) => [user.id, user]))

    const invalidMap = new Map<string, TraineeAssignmentIssueType>()

    const missingIds = traineeUserIds.filter((id) => !requestedUserMap.has(id))
    missingIds.forEach((id) => {
      invalidMap.set(id, {
        submittedId: id,
        reason: 'USER_NOT_FOUND'
      })
    })

    requestedUsers.forEach((user) => {
      if (user.deletedAt) {
        invalidMap.set(user.id, {
          submittedId: user.id,
          eid: user.eid,
          email: user.email,
          reason: 'USER_INACTIVE',
          note: 'User is inactive or deleted'
        })
        return
      }

      if (user.role?.name !== RoleName.TRAINEE) {
        invalidMap.set(user.id, {
          submittedId: user.id,
          eid: user.eid,
          email: user.email,
          reason: 'ROLE_NOT_TRAINEE',
          note: `Expected role TRAINEE but received ${user.role?.name ?? 'UNKNOWN'}`
        })
      }
    })

    const eligibleUserIds = traineeUserIds.filter((id) => !invalidMap.has(id))

    const existingEnrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId,
        traineeUserId: { in: eligibleUserIds }
      },
      select: {
        traineeUserId: true,
        batchCode: true,
        enrollmentDate: true,
        status: true,
        trainee: {
          select: userTraineeWithDepartmentSelect
        }
      }
    })

    const existingIds = new Set(existingEnrollments.map((enrollment) => enrollment.traineeUserId))

    const newIds = eligibleUserIds.filter((id) => !existingIds.has(id))
    const newEnrollments = newIds.map((id) => ({
      subjectId,
      traineeUserId: id,
      enrollmentDate: new Date(),
      batchCode,
      status: SubjectEnrollmentStatus.ENROLLED
    }))

    if (newEnrollments.length > 0) {
      await this.prisma.subjectEnrollment.createMany({
        data: newEnrollments
      })
    }

    const reactivatableEnrollments = existingEnrollments.filter(
      (enrollment) => !blockingStatuses.includes(enrollment.status as SubjectEnrollmentStatusValue)
    )

    if (reactivatableEnrollments.length > 0) {
      await this.prisma.subjectEnrollment.updateMany({
        where: {
          subjectId,
          traineeUserId: {
            in: reactivatableEnrollments.map((enrollment) => enrollment.traineeUserId)
          }
        },
        data: {
          status: SubjectEnrollmentStatus.ENROLLED,
          batchCode,
          enrollmentDate: new Date()
        }
      })
    }

    const resolveUserPayload = (user: AssignmentUserSummary): TraineeAssignmentUserType => {
      const nameParts = [user.firstName ?? '', user.lastName ?? ''].filter((part) => part.trim().length > 0)
      const fullName = nameParts.join(' ').trim()

      return {
        userId: user.id,
        eid: user.eid,
        fullName: fullName.length > 0 ? fullName : user.eid,
        email: user.email,
        department: user.department ? { id: user.department.id, name: user.department.name } : null
      }
    }

    const enrolledNew = newIds.map((id) => {
      const user = requestedUserMap.get(id)
      if (!user) {
        throw TraineeResolutionFailureException(id)
      }
      return resolveUserPayload(user)
    })

    const reactivated = reactivatableEnrollments.map((enrollment) => {
      const fallbackUser = enrollment.trainee as AssignmentUserSummary
      const user = requestedUserMap.get(enrollment.traineeUserId) ?? fallbackUser
      return resolveUserPayload(user)
    })

    const enrolled = [...enrolledNew, ...reactivated]

    const blockingEnrollments = existingEnrollments.filter((enrollment) =>
      blockingStatuses.includes(enrollment.status as SubjectEnrollmentStatusValue)
    )

    const duplicates: TraineeAssignmentDuplicateType[] = blockingEnrollments.map((enrollment) => {
      const fallbackUser = enrollment.trainee as AssignmentUserSummary
      const user = requestedUserMap.get(enrollment.traineeUserId) ?? fallbackUser

      const payload = resolveUserPayload(user)

      return {
        ...payload,
        enrolledAt: enrollment.enrollmentDate ? enrollment.enrollmentDate.toISOString() : new Date().toISOString(),
        batchCode: enrollment.batchCode
      }
    })

    const invalid = Array.from(invalidMap.values())

    return {
      enrolled,
      duplicates,
      invalid
    }
  }

  async getTraineeCoursesWithSubjects({
    traineeUserId
  }: {
    traineeUserId: string
  }): Promise<GetTraineeCourseSubjectsResType> {
    const trainee = await this.prisma.user.findUnique({
      where: {
        id: traineeUserId,
        status: UserStatus.ACTIVE
      },
      select: {
        id: true
      }
    })

    if (!trainee) {
      throw TraineeNotFoundException
    }

    const enrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        traineeUserId,
        status: {
          notIn: [SubjectEnrollmentStatus.CANCELLED]
        },
        subject: {
          status: {
            notIn: [SubjectStatus.ARCHIVED]
          },
          deletedAt: null,
          course: {
            deletedAt: null,
            status: {
              not: CourseStatus.ARCHIVED
            }
          }
        }
      },
      include: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            method: true,
            type: true,
            startDate: true,
            endDate: true,
            course: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    })

    const coursesMap = new Map<string, TraineeCourseSubjectsItemType>()

    enrollments.forEach((enrollment) => {
      const subject = enrollment.subject
      if (!subject || !subject.course) {
        return
      }

      const courseId = subject.course.id
      const subjectPayload = {
        id: subject.id,
        code: subject.code,
        name: subject.name,
        status: subject.status as SubjectStatusValue,
        method: subject.method as SubjectMethodValue,
        type: subject.type as SubjectTypeValue,
        startDate: subject.startDate ? subject.startDate.toISOString() : null,
        endDate: subject.endDate ? subject.endDate.toISOString() : null,
        batchCode: enrollment.batchCode,
        enrollmentDate: enrollment.enrollmentDate.toISOString(),
        updatedAt: enrollment.updatedAt.toISOString()
      }

      if (!coursesMap.has(courseId)) {
        coursesMap.set(courseId, {
          course: {
            id: courseId,
            code: subject.course.code,
            name: subject.course.name,
            status: subject.course.status
          },
          subjects: [subjectPayload]
        })
        return
      }

      coursesMap.get(courseId)?.subjects.push(subjectPayload)
    })

    const courses = Array.from(coursesMap.values()).map((item) => ({
      ...item,
      subjects: item.subjects.sort((a, b) => a.name.localeCompare(b.name))
    }))

    courses.sort((a, b) => a.course.name.localeCompare(b.course.name))

    return {
      traineeId: traineeUserId,
      courses
    }
  }

  async removeCourseEnrollmentsByBatch(params: { courseId: string; batchCode: string }): Promise<{
    removedCount: number
    removedSubjects: Array<{
      subjectId: string
      subjectCode: string
      subjectName: string
      removedCount: number
      removedTraineeEids: string[]
    }>
  }> {
    const { courseId, batchCode } = params

    const enrollments: Prisma.SubjectEnrollmentGetPayload<{
      select: {
        subjectId: true
        traineeUserId: true
        status: true
        subject: {
          select: {
            id: true
            code: true
            name: true
          }
        }
        trainee: {
          select: {
            eid: true
          }
        }
      }
    }>[] = await this.prisma.subjectEnrollment.findMany({
      where: {
        batchCode,
        subject: {
          courseId,
          deletedAt: null
        }
      },
      select: {
        subjectId: true,
        traineeUserId: true,
        status: true,
        subject: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        trainee: {
          select: userEidOnlySelect
        }
      }
    })

    if (enrollments.length === 0) {
      return {
        removedCount: 0,
        removedSubjects: []
      }
    }

    const subjectSummaries = new Map<
      string,
      {
        subjectId: string
        subjectCode: string
        subjectName: string
        removedCount: number
        removedTraineeEids: string[]
      }
    >()

    const affectedEnrollmentIds: Array<{ subjectId: string; traineeUserId: string }> = []

    enrollments.forEach((enrollment) => {
      const subject = enrollment.subject
      if (!subject) {
        return
      }

      if (enrollment.status === SubjectEnrollmentStatus.CANCELLED) {
        return
      }

      const summary = subjectSummaries.get(subject.id) ?? {
        subjectId: subject.id,
        subjectCode: subject.code,
        subjectName: subject.name,
        removedCount: 0,
        removedTraineeEids: [] as string[]
      }

      summary.removedCount += 1

      const eid = enrollment.trainee?.eid
      if (eid) {
        summary.removedTraineeEids.push(eid)
      }

      subjectSummaries.set(subject.id, summary)

      affectedEnrollmentIds.push({ subjectId: enrollment.subjectId, traineeUserId: enrollment.traineeUserId })
    })

    if (affectedEnrollmentIds.length === 0) {
      return {
        removedCount: 0,
        removedSubjects: []
      }
    }

    await this.prisma.subjectEnrollment.updateMany({
      where: {
        OR: affectedEnrollmentIds
      },
      data: {
        status: SubjectEnrollmentStatus.CANCELLED,
        updatedAt: new Date()
      }
    })

    const removedSubjects = Array.from(subjectSummaries.values()).sort((a, b) =>
      a.subjectCode.localeCompare(b.subjectCode)
    )

    return {
      removedCount: affectedEnrollmentIds.length,
      removedSubjects
    }
  }

  async removeEnrollments({
    subjectId,
    traineeEids
  }: {
    subjectId: string
    traineeEids: string[]
  }): Promise<{ removedTrainees: string[]; notFoundTrainees: string[] }> {
    // Get trainee IDs from EIDs
    const trainees = await this.sharedUserRepo.findActiveUsersByEids(traineeEids)

    const traineeMap = new Map(trainees.map((trainee) => [trainee.eid, trainee.id]))
    const traineeIds = trainees.map((t) => t.id)

    // Find existing enrollments
    const existingEnrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId,
        traineeUserId: { in: traineeIds }
      },
      select: {
        traineeUserId: true,
        trainee: {
          select: userEidOnlySelect
        }
      }
    })

    const existingTraineeIds = existingEnrollments.map((enr) => enr.traineeUserId)
    const removedTrainees = existingEnrollments.map((enr) => enr.trainee.eid)

    // Find not found trainees
    const notFoundTrainees = traineeEids.filter(
      (eid) => !traineeMap.has(eid) || !existingTraineeIds.includes(traineeMap.get(eid)!)
    )

    // Remove enrollments
    if (existingTraineeIds.length > 0) {
      await this.prisma.subjectEnrollment.deleteMany({
        where: {
          subjectId,
          traineeUserId: { in: existingTraineeIds }
        }
      })
    }

    return {
      removedTrainees,
      notFoundTrainees
    }
  }

  async removeCourseEnrollmentsForTrainee({
    traineeEid,
    courseCode
  }: {
    traineeEid: string
    courseCode: string
  }): Promise<{ removedEnrollmentsCount: number; affectedSubjectCodes: string[] }> {
    // Find trainee by EID
    const trainee = await this.prisma.user.findFirst({
      where: {
        eid: traineeEid,
        deletedAt: null,
        role: {
          name: RoleName.TRAINEE
        }
      },
      select: {
        id: true
      }
    })

    if (!trainee) {
      throw TraineeNotFoundException
    }

    // Find course by code
    const course = await this.prisma.course.findFirst({
      where: {
        code: courseCode,
        deletedAt: null,
        status: {
          not: CourseStatus.ARCHIVED
        }
      },
      select: {
        id: true
      }
    })

    if (!course) {
      throw CourseNotFoundException
    }

    // Find subjects in the course
    const subjects = await this.prisma.subject.findMany({
      where: {
        courseId: course.id,
        deletedAt: null
      },
      select: {
        id: true,
        code: true
      }
    })

    if (subjects.length === 0) {
      return {
        removedEnrollmentsCount: 0,
        affectedSubjectCodes: []
      }
    }

    const subjectIds = subjects.map((subject) => subject.id)

    // Find enrollments with ENROLLED status only
    const enrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId: {
          in: subjectIds
        },
        traineeUserId: trainee.id,
        status: SubjectEnrollmentStatus.ENROLLED
      },
      select: {
        subjectId: true
      }
    })

    if (enrollments.length === 0) {
      return {
        removedEnrollmentsCount: 0,
        affectedSubjectCodes: []
      }
    }

    const affectedSubjectIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.subjectId)))

    // Cancel ENROLLED enrollments instead of hard delete
    const now = new Date()
    const { count } = await this.prisma.subjectEnrollment.updateMany({
      where: {
        subjectId: {
          in: affectedSubjectIds
        },
        traineeUserId: trainee.id,
        status: SubjectEnrollmentStatus.ENROLLED
      },
      data: {
        status: SubjectEnrollmentStatus.CANCELLED,
        updatedAt: now
      }
    })

    // Get subject codes for affected subjects
    const affectedSubjects = subjects.filter((subject) => affectedSubjectIds.includes(subject.id))
    const affectedSubjectCodes = affectedSubjects.map((subject) => subject.code)

    return {
      removedEnrollmentsCount: count,
      affectedSubjectCodes
    }
  }

  async isTrainerAssignedToSubject({
    subjectId,
    trainerUserId
  }: {
    subjectId: string
    trainerUserId: string
  }): Promise<boolean> {
    const assignment = await this.prisma.subjectInstructor.findUnique({
      where: {
        trainerUserId_subjectId: {
          trainerUserId,
          subjectId
        }
      }
    })
    return !!assignment
  }

  async getTraineeEnrollments({
    traineeUserId,
    batchCode,
    status,
    courseId
  }: {
    traineeUserId: string
    batchCode?: string
    status?: SubjectEnrollmentStatusValue
    courseId?: string
  }): Promise<{
    trainee: TraineeEnrollmentUserType
    enrollments: TraineeEnrollmentRecordType[]
  }> {
    const trainee = await this.prisma.user.findUnique({
      where: { id: traineeUserId },
      select: userTraineeWithDepartmentSelect
    })

    if (!trainee) {
      throw TraineeNotFoundException
    }

    const where: Prisma.SubjectEnrollmentWhereInput = {
      traineeUserId
    }

    if (batchCode) {
      where.batchCode = batchCode
    }

    if (status) {
      where.status = status
    }

    if (courseId) {
      const existingSubjectFilter = (where.subject as Prisma.SubjectWhereInput | undefined) ?? {}
      const existingCourseFilter = (existingSubjectFilter.course as Prisma.CourseWhereInput | undefined) ?? {}

      const subjectFilter: Prisma.SubjectWhereInput = {
        ...existingSubjectFilter,
        courseId,
        deletedAt: null,
        course: {
          ...existingCourseFilter,
          deletedAt: null,
          status: {
            not: CourseStatus.ARCHIVED
          }
        }
      }

      where.subject = subjectFilter
    }

    const enrollments = await this.prisma.subjectEnrollment.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            type: true,
            method: true,
            startDate: true,
            endDate: true,
            course: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    const nameParts = [trainee.firstName ?? '', trainee.lastName ?? ''].filter((part) => part.trim().length > 0)
    const traineeInfo: TraineeEnrollmentUserType = {
      userId: trainee.id,
      eid: trainee.eid,
      fullName: nameParts.length > 0 ? nameParts.join(' ') : trainee.eid,
      email: trainee.email,
      department: trainee.department ? { id: trainee.department.id, name: trainee.department.name } : null
    }

    const enrollmentDetails: TraineeEnrollmentRecordType[] = enrollments.map((e) => ({
      subject: {
        id: e.subject.id,
        code: e.subject.code,
        name: e.subject.name,
        status: e.subject.status as SubjectStatusValue,
        type: e.subject.type as SubjectTypeValue,
        method: e.subject.method as SubjectMethodValue,
        startDate: e.subject.startDate ? e.subject.startDate.toISOString() : null,
        endDate: e.subject.endDate ? e.subject.endDate.toISOString() : null,
        course: e.subject.course ? { id: e.subject.course.id, name: e.subject.course.name } : null
      },
      enrollment: {
        batchCode: e.batchCode,
        status: e.status as SubjectEnrollmentStatusValue,
        enrollmentDate: e.enrollmentDate,
        updatedAt: e.updatedAt
      }
    }))

    return {
      trainee: traineeInfo,
      enrollments: enrollmentDetails
    }
  }

  /**
   * Cancel specific subject enrollment for a trainee
   */
  async cancelSubjectEnrollment({
    subjectId,
    traineeUserId,
    batchCode
  }: {
    subjectId: string
    traineeUserId: string
    batchCode: string
  }): Promise<boolean> {
    // Check if enrollment exists and is ENROLLED
    const enrollment = await this.prisma.subjectEnrollment.findUnique({
      where: {
        traineeUserId_subjectId: {
          traineeUserId,
          subjectId
        }
      }
    })

    if (!enrollment || enrollment.batchCode !== batchCode || enrollment.status !== 'ENROLLED') {
      return false
    }

    // Update to CANCELLED
    await this.prisma.subjectEnrollment.update({
      where: {
        traineeUserId_subjectId: {
          traineeUserId,
          subjectId
        }
      },
      data: {
        status: 'CANCELLED'
      }
    })

    return true
  }

  async getCourseTraineeCount(courseId: string): Promise<{ current: number; max: number | null }> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { maxNumTrainee: true }
    })

    const subjectIds = await this.prisma.subject.findMany({
      where: { courseId, deletedAt: null },
      select: { id: true }
    })

    const subjectIdsList = map(subjectIds, 'id')

    const distinctTrainees = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId: { in: subjectIdsList }
      },
      select: {
        traineeUserId: true
      },
      distinct: ['traineeUserId']
    })

    return {
      current: distinctTrainees.length,
      max: course?.maxNumTrainee || null
    }
  }

  async getCourseEnrollmentBatches(courseId: string): Promise<CourseEnrollmentBatchSummaryType[]> {
    const enrollments: Prisma.SubjectEnrollmentGetPayload<{
      select: {
        batchCode: true
        status: true
        subject: {
          select: {
            id: true
            code: true
            name: true
          }
        }
      }
    }>[] = await this.prisma.subjectEnrollment.findMany({
      where: {
        subject: {
          courseId,
          deletedAt: null
        }
      },
      select: {
        batchCode: true,
        status: true,
        subject: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    })

    const createEmptyStatusCounts = () => ({
      ENROLLED: 0,
      ON_GOING: 0,
      CANCELLED: 0,
      FINISHED: 0
    })

    type StatusCounts = ReturnType<typeof createEmptyStatusCounts>

    type BatchAccumulator = {
      totalTrainees: number
      statusCounts: StatusCounts
      subjects: Map<
        string,
        {
          subjectId: string
          subjectCode: string
          subjectName: string
          totalTrainees: number
          statusCounts: StatusCounts
        }
      >
    }

    const batchesMap = new Map<string, BatchAccumulator>()

    enrollments.forEach((enrollment) => {
      const batchCode = enrollment.batchCode
      if (!batchCode) {
        return
      }

      const summary = batchesMap.get(batchCode) ?? {
        totalTrainees: 0,
        statusCounts: createEmptyStatusCounts(),
        subjects: new Map()
      }

      summary.totalTrainees += 1

      const status = enrollment.status as SubjectEnrollmentStatusValue
      if (status && summary.statusCounts[status] !== undefined) {
        summary.statusCounts[status] += 1
      }

      const subject = enrollment.subject
      if (subject) {
        const subjectSummary = summary.subjects.get(subject.id) ?? {
          subjectId: subject.id,
          subjectCode: subject.code,
          subjectName: subject.name,
          totalTrainees: 0,
          statusCounts: createEmptyStatusCounts()
        }

        subjectSummary.totalTrainees += 1

        if (status && subjectSummary.statusCounts[status] !== undefined) {
          subjectSummary.statusCounts[status] += 1
        }

        summary.subjects.set(subject.id, subjectSummary)
      }

      batchesMap.set(batchCode, summary)
    })

    const mapStatusCountsToActive = (counts: StatusCounts) => counts.ENROLLED + counts.ON_GOING

    return Array.from(batchesMap.entries())
      .sort(([batchA], [batchB]) => batchA.localeCompare(batchB))
      .map(([batchCode, summary]) => ({
        batchCode,
        totalTrainees: summary.totalTrainees,
        activeTrainees: mapStatusCountsToActive(summary.statusCounts),
        statusCounts: { ...summary.statusCounts },
        subjects: Array.from(summary.subjects.values())
          .sort((subjectA, subjectB) => subjectA.subjectCode.localeCompare(subjectB.subjectCode))
          .map((subjectSummary) => ({
            ...subjectSummary,
            activeTrainees: mapStatusCountsToActive(subjectSummary.statusCounts)
          }))
      }))
  }
}

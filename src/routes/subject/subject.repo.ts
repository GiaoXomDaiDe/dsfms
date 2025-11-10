import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { map } from 'lodash'
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
import { CourseIdParamsType } from '~/shared/models/shared-course.model'
import { SubjectType } from '~/shared/models/shared-subject.model'
import { SharedCourseRepository } from '~/shared/repositories/shared-course.repo'
import { AssignmentUserForSubject, SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  CannotArchiveSubjectWithNonCancelledEnrollmentsException,
  CourseNotFoundException,
  SubjectNotFoundException,
  TraineeNotFoundException,
  TraineeResolutionFailureException,
  TrainerBelongsToAnotherDepartmentException,
  TrainerNotFoundException
} from './subject.error'
import {
  AssignTrainerResType,
  CreateSubjectBodyType,
  GetAvailableTrainersResType,
  GetSubjectDetailResType,
  GetSubjectsQueryType,
  GetSubjectsResType,
  GetSubjectsType,
  LookupTraineesBodyType,
  LookupTraineesResType,
  SubjectDetailCourseType,
  SubjectDetailEnrollmentsByBatchType,
  SubjectDetailInstructorType,
  SubjectDetailTraineeType,
  SubjectEnrollmentBatchSummaryType,
  TraineeAssignmentDuplicateType,
  TraineeAssignmentIssueType,
  TraineeAssignmentUserType,
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
export class SubjectRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sharedCourseRepo: SharedCourseRepository,
    private readonly sharedUserRepo: SharedUserRepository
  ) {}

  async list(query: GetSubjectsQueryType & { includeDeleted?: boolean }): Promise<GetSubjectsResType> {
    const { method, type, isSIM, courseId, status, includeDeleted } = query

    const where: Prisma.SubjectWhereInput = {
      // Lọc soft delete - chỉ hiện bản ghi chưa xóa trừ khi includeDeleted = true
      ...(includeDeleted ? {} : { deletedAt: null }),

      // Các bộ lọc nghiệp vụ
      ...(courseId && { courseId: courseId }),
      ...(method && { method: method as SubjectMethodValue }),
      ...(isSIM !== undefined && { isSIM: isSIM }),
      ...(type && { type: type as SubjectTypeValue }),

      // Lọc status - nếu user chọn ARCHIVED thì hiện ARCHIVED
      // Nếu không truyền status và includeDeleted = false thì mặc định ẩn ARCHIVED
      ...(status
        ? { status: status as SubjectStatusValue }
        : includeDeleted
          ? {}
          : { status: { not: 'ARCHIVED' as SubjectStatusValue } })
    }

    const [subjects, totalItems] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        include: {
          _count: {
            select: {
              instructors: true,
              enrollments: {
                where: {
                  status: { not: 'CANCELLED' }
                }
              }
            }
          }
        }
      }),
      this.prisma.subject.count({ where })
    ])

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
      totalItems
    }
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<GetSubjectDetailResType | null> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null })
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            department: {
              select: {
                id: true,
                name: true,
                code: true,
                isActive: true
              }
            }
          }
        },
        instructors: {
          include: {
            trainer: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                middleName: true,
                lastName: true,
                status: true,
                createdAt: true
              }
            }
          },
          where: includeDeleted
            ? {}
            : {
                trainer: {
                  deletedAt: null,
                  status: 'ACTIVE'
                }
              }
        },
        enrollments: {
          include: {
            trainee: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                middleName: true,
                lastName: true,
                status: true
              }
            }
          },
          where: includeDeleted
            ? {}
            : {
                trainee: {
                  deletedAt: null
                }
              }
        }
      }
    })

    if (!subject) return null

    const transformedInstructors: SubjectDetailInstructorType[] = subject.instructors.map((instructor) => ({
      id: instructor.trainer.id,
      eid: instructor.trainer.eid,
      firstName: instructor.trainer.firstName,
      middleName: instructor.trainer.middleName === null ? '' : instructor.trainer.middleName,
      lastName: instructor.trainer.lastName,
      status: instructor.trainer.status,
      roleInSubject: instructor.roleInAssessment
    }))

    const enrollmentsByBatch: SubjectDetailEnrollmentsByBatchType[] = subject.enrollments.reduce((acc, enrollment) => {
      const existingBatch = acc.find((batch) => batch.batchCode === enrollment.batchCode)

      const traineeData: SubjectDetailTraineeType = {
        id: enrollment.trainee.id,
        eid: enrollment.trainee.eid,
        firstName: enrollment.trainee.firstName,
        middleName: enrollment.trainee.middleName,
        lastName: enrollment.trainee.lastName,
        status: enrollment.trainee.status,
        enrollmentDate: enrollment.enrollmentDate,
        enrollmentStatus: enrollment.status
      }

      if (existingBatch) {
        existingBatch.trainees.push(traineeData)
      } else {
        acc.push({
          batchCode: enrollment.batchCode,
          trainees: [traineeData]
        })
      }

      return acc
    }, [] as SubjectDetailEnrollmentsByBatchType[])

    const transformedCourse: SubjectDetailCourseType = subject.course
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

    const { courseId, createdById, updatedById, enrollments, ...subjectWithoutRedundant } = subject

    return {
      ...subjectWithoutRedundant,
      course: transformedCourse,
      instructors: transformedInstructors,
      enrollmentsByBatch
    } as GetSubjectDetailResType
  }

  async getAvailableTrainers(courseId: CourseIdParamsType): Promise<GetAvailableTrainersResType> {
    const [subjectIds, departmentId] = await Promise.all([
      this.prisma.subject.findMany({
        where: {
          courseId,
          deletedAt: null,
          status: { not: 'ARCHIVED' }
        },
        select: { id: true },
        distinct: ['id']
      }),
      this.sharedCourseRepo.findActiveDepartmentId(courseId)
    ])

    const subjectIdsList = map(subjectIds, 'id')

    const assignedInstructorIds = await this.prisma.subjectInstructor.findMany({
      where: {
        subjectId: { in: subjectIdsList }
      },
      select: { trainerUserId: true },
      distinct: ['trainerUserId']
    })

    const assignedIds = map(assignedInstructorIds, 'trainerUserId')
    const availableTrainers = await this.sharedUserRepo.findActiveTrainers({ excludeUserIds: assignedIds })

    const trainersWithFlag = availableTrainers.map((trainer) => ({
      ...trainer,
      belongsToDepartment: departmentId ? trainer.departmentId === departmentId : false
    }))

    return { trainers: trainersWithFlag, totalCount: trainersWithFlag.length }
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

      if (trainer.departmentId && trainer.departmentId !== subject.course.departmentId) {
        throw TrainerBelongsToAnotherDepartmentException
      }

      if (!trainer.departmentId) {
        await tx.user.update({
          where: { id: trainerUserId },
          data: {
            departmentId: subject.course.departmentId
          }
        })
      }

      const assignment = await tx.subjectInstructor.create({
        data: {
          subjectId,
          trainerUserId,
          roleInAssessment: roleInSubject
        },
        include: {
          subject: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
              courseId: true,
              startDate: true,
              endDate: true,
              course: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          trainer: {
            select: {
              id: true,
              eid: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              status: true,
              department: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
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
    batchCode
  }: {
    subjectId: string
    traineeUserIds: string[]
    batchCode: string
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
        trainee: {
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

    const enrolled = newIds.map((id) => {
      const user = requestedUserMap.get(id)
      if (!user) {
        throw TraineeResolutionFailureException(id)
      }
      return resolveUserPayload(user)
    })

    const duplicates: TraineeAssignmentDuplicateType[] = existingEnrollments.map((enrollment) => {
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

  async getSubjectEnrollmentBatches(subjectId: string): Promise<SubjectEnrollmentBatchSummaryType[]> {
    const enrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId
      },
      select: {
        batchCode: true,
        status: true
      }
    })

    const createEmptyStatusCounts = () => ({
      ENROLLED: 0,
      ON_GOING: 0,
      CANCELLED: 0,
      FINISHED: 0
    })

    type StatusCounts = ReturnType<typeof createEmptyStatusCounts>

    const summaryMap = new Map<string, { total: number; statusCounts: StatusCounts }>()

    enrollments.forEach((enrollment) => {
      const batchCode = enrollment.batchCode
      if (!batchCode) {
        return
      }

      const existing = summaryMap.get(batchCode)
      const summary = existing ?? { total: 0, statusCounts: createEmptyStatusCounts() }

      summary.total += 1

      const status = enrollment.status as SubjectEnrollmentStatusValue
      if (status && summary.statusCounts[status] !== undefined) {
        summary.statusCounts[status] += 1
      }

      summaryMap.set(batchCode, summary)
    })

    return Array.from(summaryMap.entries())
      .sort(([batchA], [batchB]) => batchA.localeCompare(batchB))
      .map(([batchCode, summary]) => ({
        batchCode,
        totalTrainees: summary.total,
        activeTrainees: summary.statusCounts.ENROLLED + summary.statusCounts.ON_GOING,
        statusCounts: { ...summary.statusCounts }
      }))
  }

  async removeEnrollmentsByBatch({
    subjectId,
    batchCode
  }: {
    subjectId: string
    batchCode: string
  }): Promise<{ removedCount: number; removedTraineeEids: string[] }> {
    const enrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId,
        batchCode
      },
      select: {
        trainee: {
          select: {
            eid: true
          }
        }
      }
    })

    const removedTraineeEids = enrollments
      .map((enrollment) => enrollment.trainee?.eid)
      .filter((eid): eid is string => Boolean(eid))

    if (removedTraineeEids.length > 0) {
      await this.prisma.subjectEnrollment.deleteMany({
        where: {
          subjectId,
          batchCode
        }
      })
    }

    return {
      removedCount: removedTraineeEids.length,
      removedTraineeEids
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
          select: { eid: true }
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
        deletedAt: null
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

    // Delete ENROLLED enrollments
    await this.prisma.subjectEnrollment.deleteMany({
      where: {
        subjectId: {
          in: affectedSubjectIds
        },
        traineeUserId: trainee.id,
        status: SubjectEnrollmentStatus.ENROLLED
      }
    })

    // Get subject codes for affected subjects
    const affectedSubjects = subjects.filter((subject) => affectedSubjectIds.includes(subject.id))
    const affectedSubjectCodes = affectedSubjects.map((subject) => subject.code)

    return {
      removedEnrollmentsCount: enrollments.length,
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
    status
  }: {
    traineeUserId: string
    batchCode?: string
    status?: SubjectEnrollmentStatusValue
  }): Promise<{
    trainee: TraineeEnrollmentUserType
    enrollments: TraineeEnrollmentRecordType[]
  }> {
    const trainee = await this.prisma.user.findUnique({
      where: { id: traineeUserId },
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
}

import { Injectable } from '@nestjs/common'
import { SubjectEnrollmentStatus, SubjectStatus } from '@prisma/client'
import {
  SubjectNotFoundException,
  TrainerBelongsToAnotherDepartmentException,
  TrainerNotFoundException
} from '~/routes/subject/subject.error'
import { RoleName } from '~/shared/constants/auth.constant'
import { CourseStatus } from '~/shared/constants/course.constant'
import { SubjectInstructorRoleValue } from '~/shared/constants/subject.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { SharedSubjectEnrollmentRepository } from '~/shared/repositories/shared-subject-enrollment.repo'
import { SharedSubjectRepository } from '~/shared/repositories/shared-subject.repo'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  CannotArchiveCourseWithActiveSubjectsException,
  CannotArchiveCourseWithNonCancelledEnrollmentsException,
  CannotAssignExaminerToArchivedCourseException,
  CourseExaminerAlreadyAssignedException,
  CourseExaminerAlreadyAssignedForSubjectException,
  CourseNotFoundException
} from './course.error'
import {
  CourseExaminerAssignmentType,
  CourseTraineeInfoType,
  CourseType,
  CreateCourseBodyType,
  CreateCourseResType,
  GetCourseResType,
  GetCoursesQueryType,
  GetCoursesResType,
  GetCourseTraineesResType,
  UpdateCourseBodyType,
  UpdateCourseResType
} from './course.model'

@Injectable()
@SerializeAll(['aggregateCourseTrainees'])
export class CourseRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sharedSubjectRepo: SharedSubjectRepository,
    private readonly sharedSubjectEnrollmentRepo: SharedSubjectEnrollmentRepository
  ) {}

  async list({ includeDeleted = false }: GetCoursesQueryType): Promise<GetCoursesResType> {
    const whereClause = includeDeleted
      ? {}
      : {
          status: {
            not: CourseStatus.ARCHIVED
          },
          deletedAt: null
        }

    const [totalItems, courses] = await Promise.all([
      this.prisma.course.count({ where: whereClause }),
      this.prisma.course.findMany({
        where: whereClause,
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              description: true
            }
          }
        }
      })
    ])

    return {
      courses,
      totalItems
    }
  }

  async getCourseTrainees({
    courseId,
    batchCode
  }: {
    courseId: string
    batchCode?: string
  }): Promise<GetCourseTraineesResType> {
    const subjectIdsList = await this.sharedSubjectRepo.findIds({
      courseId,
      deletedAt: null
    })

    if (subjectIdsList.length === 0) {
      return {
        trainees: [],
        totalItems: 0
      }
    }

    const enrollments = await this.sharedSubjectEnrollmentRepo.findMany({
      where: {
        subjectId: {
          in: subjectIdsList
        },
        ...(batchCode ? { batchCode } : {})
      },
      select: {
        traineeUserId: true,
        batchCode: true,
        trainee: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    const trainees = this.aggregateCourseTrainees(enrollments)

    return {
      trainees,
      totalItems: trainees.length
    }
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<GetCourseResType | null> {
    const whereClause = includeDeleted
      ? { id }
      : {
          id,
          status: {
            not: CourseStatus.ARCHIVED
          },
          deletedAt: null
        }
    const course = await this.prisma.course.findFirst({
      where: whereClause,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true
          }
        },
        subjects: {
          where: {
            deletedAt: null
          }
        },
        _count: {
          select: {
            subjects: {
              where: {
                deletedAt: null
              }
            }
          }
        }
      }
    })

    if (!course) return null

    const [traineeCount, examinerRecords] = await Promise.all([
      this.prisma.subjectEnrollment
        .findMany({
          where: {
            subject: {
              courseId: id,
              deletedAt: null
            }
          },
          select: {
            traineeUserId: true
          },
          distinct: ['traineeUserId']
        })
        .then((enrollments) => enrollments.length),
      this.prisma.assessmentExaminer.findMany({
        where: {
          OR: [
            { courseId: id },
            {
              subject: {
                courseId: id,
                deletedAt: null
              }
            }
          ]
        },
        include: {
          trainer: {
            select: {
              id: true,
              eid: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              status: true
            }
          },
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

    const trainerCount = new Set(examinerRecords.map((record) => record.trainerUserId)).size

    const courseExaminers = examinerRecords.map((record) => {
      const belongsByCourseId = record.courseId === id
      const subjectCourseId = record.subject?.courseId ?? null
      const subjectBelongs = subjectCourseId === id

      let scope: 'COURSE' | 'SUBJECT' | 'COURSE_AND_SUBJECT' | 'CROSS_SUBJECT'

      if (belongsByCourseId && subjectBelongs) {
        scope = 'COURSE_AND_SUBJECT'
      } else if (belongsByCourseId) {
        scope = 'COURSE'
      } else if (subjectBelongs) {
        scope = 'SUBJECT'
      } else {
        scope = 'CROSS_SUBJECT'
      }

      return {
        trainer: {
          id: record.trainer.id,
          eid: record.trainer.eid,
          firstName: record.trainer.firstName,
          middleName: record.trainer.middleName,
          lastName: record.trainer.lastName,
          email: record.trainer.email,
          phoneNumber: record.trainer.phoneNumber,
          status: record.trainer.status
        },
        role: record.roleInSubject,
        scope,
        subject: record.subject
          ? {
              id: record.subject.id,
              courseId: record.subject.courseId,
              code: record.subject.code,
              name: record.subject.name,
              status: record.subject.status,
              startDate: record.subject.startDate,
              endDate: record.subject.endDate
            }
          : null,
        assignedAt: record.createdAt
      }
    })

    const { subjects, _count, ...courseData } = course

    return {
      ...courseData,
      subjectCount: _count.subjects,
      traineeCount,
      trainerCount,
      subjects,
      courseExaminers
    }
  }

  async create({
    data,
    createdById
  }: {
    data: CreateCourseBodyType
    createdById: string
  }): Promise<CreateCourseResType> {
    return this.prisma.course.create({
      data: {
        ...data,
        createdById,
        updatedById: createdById
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true
          }
        }
      },
      omit: {
        departmentId: true
      }
    })
  }

  async update({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateCourseBodyType
    updatedById: string
  }): Promise<UpdateCourseResType> {
    return this.prisma.course.update({
      where: { id },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true
          }
        }
      },
      omit: {
        departmentId: true
      }
    })
  }

  async archive({ id, deletedById, status }: { id: string; deletedById: string; status: string }): Promise<CourseType> {
    const now = new Date()

    if (status === CourseStatus.PLANNED) {
      return await this.prisma.$transaction(async (tx) => {
        await tx.subjectEnrollment.updateMany({
          where: {
            subject: {
              courseId: id
            },
            status: {
              not: SubjectEnrollmentStatus.CANCELLED
            }
          },
          data: {
            status: SubjectEnrollmentStatus.CANCELLED,
            updatedAt: now
          }
        })

        await tx.subject.updateMany({
          where: {
            courseId: id,
            deletedAt: null,
            status: {
              not: SubjectStatus.ARCHIVED
            }
          },
          data: {
            status: SubjectStatus.ARCHIVED,
            deletedAt: now,
            deletedById,
            updatedAt: now,
            updatedById: deletedById
          }
        })

        return tx.course.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedById,
            status: CourseStatus.ARCHIVED,
            updatedById: deletedById,
            updatedAt: now
          }
        })
      })
    }

    if (status === CourseStatus.ON_GOING) {
      return await this.prisma.$transaction(async (tx) => {
        const activeSubjectCount = await tx.subject.count({
          where: {
            courseId: id,
            deletedAt: null,
            status: {
              not: SubjectStatus.ARCHIVED
            }
          }
        })

        if (activeSubjectCount > 0) {
          throw CannotArchiveCourseWithActiveSubjectsException
        }

        const activeEnrollmentCount = await tx.subjectEnrollment.count({
          where: {
            subject: {
              courseId: id
            },
            status: {
              not: SubjectEnrollmentStatus.CANCELLED
            }
          }
        })

        if (activeEnrollmentCount > 0) {
          throw CannotArchiveCourseWithNonCancelledEnrollmentsException
        }

        return tx.course.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedById,
            status: CourseStatus.ARCHIVED,
            updatedById: deletedById,
            updatedAt: now
          }
        })
      })
    }

    return this.prisma.course.update({
      where: { id },
      data: {
        deletedAt: now,
        deletedById,
        status: CourseStatus.ARCHIVED,
        updatedById: deletedById,
        updatedAt: now
      }
    })
  }

  async cancelCourseEnrollments({
    courseId,
    traineeUserId,
    batchCode
  }: {
    courseId: string
    traineeUserId: string
    batchCode: string
  }): Promise<{ cancelledCount: number; notCancelledCount: number }> {
    const subjectIdsList = await this.sharedSubjectRepo.findIds({ courseId, deletedAt: null })

    if (subjectIdsList.length === 0) {
      return { cancelledCount: 0, notCancelledCount: 0 }
    }

    const cancellationFilter = {
      traineeUserId,
      subjectId: { in: subjectIdsList },
      batchCode,
      status: SubjectEnrollmentStatus.ENROLLED
    }

    const cancelledCount = await this.sharedSubjectEnrollmentRepo.updateMany({
      where: cancellationFilter,
      data: {
        status: SubjectEnrollmentStatus.CANCELLED
      }
    })

    const notCancelledCount = await this.sharedSubjectEnrollmentRepo.count({
      traineeUserId,
      subjectId: { in: subjectIdsList },
      batchCode,
      status: { not: SubjectEnrollmentStatus.ENROLLED }
    })

    return { cancelledCount, notCancelledCount }
  }

  async assignExaminerToCourse({
    courseId,
    trainerUserId,
    roleInSubject,
    subjectId
  }: {
    courseId: string
    trainerUserId: string
    roleInSubject: SubjectInstructorRoleValue
    subjectId?: string
  }): Promise<CourseExaminerAssignmentType> {
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findFirst({
        where: {
          id: courseId,
          deletedAt: null
        },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      if (!course) {
        throw CourseNotFoundException
      }

      if (course.status === CourseStatus.ARCHIVED) {
        throw CannotAssignExaminerToArchivedCourseException
      }

      const existingCourseAssignment = await tx.assessmentExaminer.findFirst({
        where: {
          trainerUserId,
          courseId
        },
        select: {
          id: true
        }
      })

      if (existingCourseAssignment) {
        throw CourseExaminerAlreadyAssignedException
      }

      let subject: {
        id: string
        courseId: string
        code: string
        name: string
        status: SubjectStatus
        startDate: Date
        endDate: Date
      } | null = null

      if (subjectId) {
        subject = await tx.subject.findFirst({
          where: {
            id: subjectId,
            deletedAt: null
          },
          select: {
            id: true,
            courseId: true,
            code: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true
          }
        })

        if (!subject) {
          throw SubjectNotFoundException
        }

        const existingSubjectAssignment = await tx.assessmentExaminer.findFirst({
          where: {
            trainerUserId,
            subjectId
          },
          select: {
            id: true
          }
        })

        if (existingSubjectAssignment) {
          throw CourseExaminerAlreadyAssignedForSubjectException
        }
      }

      const trainer = await tx.user.findFirst({
        where: {
          id: trainerUserId,
          deletedAt: null,
          role: {
            name: RoleName.TRAINER
          }
        },
        select: {
          id: true,
          eid: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          status: true,
          departmentId: true
        }
      })

      if (!trainer) {
        throw TrainerNotFoundException
      }

      if (trainer.departmentId && trainer.departmentId !== course.departmentId) {
        throw TrainerBelongsToAnotherDepartmentException
      }

      if (!trainer.departmentId) {
        await tx.user.update({
          where: { id: trainerUserId },
          data: {
            departmentId: course.departmentId
          }
        })
      }

      const assignment = await tx.assessmentExaminer.create({
        data: {
          trainerUserId,
          courseId,
          subjectId: subjectId ?? null,
          roleInSubject
        },
        select: {
          createdAt: true
        }
      })

      return {
        trainer: {
          id: trainer.id,
          eid: trainer.eid,
          firstName: trainer.firstName,
          middleName: trainer.middleName,
          lastName: trainer.lastName,
          email: trainer.email,
          phoneNumber: trainer.phoneNumber,
          status: trainer.status
        },
        course: {
          id: course.id,
          code: course.code,
          name: course.name,
          status: course.status,
          startDate: course.startDate,
          endDate: course.endDate
        },
        subject: subject
          ? {
              id: subject.id,
              courseId: subject.courseId,
              code: subject.code,
              name: subject.name,
              status: subject.status,
              startDate: subject.startDate,
              endDate: subject.endDate
            }
          : null,
        role: roleInSubject,
        assignedAt: assignment.createdAt
      }
    })
  }

  private aggregateCourseTrainees(
    enrollments: Array<{
      traineeUserId: string
      batchCode: string | null
      trainee: {
        id: string
        eid: string
        firstName: string
        lastName: string
        email: string
      } | null
    }>
  ): CourseTraineeInfoType[] {
    type TraineeAccumulator = Omit<CourseTraineeInfoType, 'batches'> & { batches: Set<string> }

    const traineeMap = new Map<string, TraineeAccumulator>()

    for (const enrollment of enrollments) {
      const trainee = enrollment.trainee
      if (!trainee) {
        continue
      }

      if (!traineeMap.has(enrollment.traineeUserId)) {
        traineeMap.set(enrollment.traineeUserId, {
          id: trainee.id,
          eid: trainee.eid,
          firstName: trainee.firstName,
          lastName: trainee.lastName,
          email: trainee.email,
          enrollmentCount: 0,
          batches: new Set<string>()
        })
      }
      const current = traineeMap.get(enrollment.traineeUserId)
      if (!current) {
        continue
      }

      current.enrollmentCount += 1

      if (enrollment.batchCode) {
        current.batches.add(enrollment.batchCode)
      }
    }

    return Array.from(traineeMap.values()).map(({ batches, ...info }) => ({
      ...info,
      batches: Array.from(batches)
    }))
  }
}

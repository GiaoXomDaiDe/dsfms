import { Injectable } from '@nestjs/common'
import { SubjectEnrollmentStatus, SubjectStatus } from '@prisma/client'
import { TrainerNotFoundException } from '~/routes/subject/subject.error'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import { CourseStatus } from '~/shared/constants/course.constant'
import { SubjectInstructorRoleValue } from '~/shared/constants/subject.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { SharedSubjectEnrollmentRepository } from '~/shared/repositories/shared-subject-enrollment.repo'
import { SharedSubjectRepository } from '~/shared/repositories/shared-subject.repo'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  CannotArchiveCourseWithActiveSubjectsException,
  CannotArchiveCourseWithNonCancelledEnrollmentsException,
  CourseNotFoundException
} from './course.error'
import {
  AssignCourseTrainerResType,
  CourseTraineeInfoType,
  CourseType,
  CreateCourseBodyType,
  CreateCourseResType,
  GetCourseResType,
  GetCoursesQueryType,
  GetCoursesResType,
  GetCourseTraineesResType,
  UpdateCourseBodyType,
  UpdateCourseResType,
  UpdateCourseTrainerAssignmentResType
} from './course.model'

type CourseInstructorSummary = {
  id: string
  eid: string
  firstName: string
  middleName: string | null
  lastName: string
  email: string
  phoneNumber: string | null
  status: (typeof UserStatus)[keyof typeof UserStatus]
  roleInCourse: SubjectInstructorRoleValue[]
}

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
    ])

    const formattedCourses = courses.map(({ _count, ...course }) => ({
      ...course,
      totalSubjects: _count.subjects
    }))

    return {
      courses: formattedCourses,
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

    const [traineeCount, courseInstructorRecords, subjectInstructorRecords] = await Promise.all([
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
      this.prisma.courseInstructor.findMany({
        where: {
          courseId: id,
          trainer: {
            deletedAt: null,
            status: UserStatus.ACTIVE
          }
        },
        select: {
          trainerUserId: true,
          courseId: true,
          roleInAssessment: true,
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
          }
        }
      }),
      this.prisma.subjectInstructor.findMany({
        where: {
          subject: {
            courseId: id,
            deletedAt: null
          },
          trainer: {
            deletedAt: null,
            status: UserStatus.ACTIVE
          }
        },
        select: {
          trainerUserId: true,
          subjectId: true,
          roleInAssessment: true,
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

    const trainerIds = new Set<string>([
      ...courseInstructorRecords.map((record) => record.trainerUserId),
      ...subjectInstructorRecords.map((record) => record.trainerUserId)
    ])

    const instructorsMap = new Map<string, CourseInstructorSummary>()

    const upsertInstructor = (record: {
      trainer: {
        id: string
        eid: string
        firstName: string
        middleName: string | null
        lastName: string
        email: string
        phoneNumber: string | null
        status: (typeof UserStatus)[keyof typeof UserStatus]
      }
      roleInAssessment: SubjectInstructorRoleValue
    }) => {
      const role = record.roleInAssessment
      const existing = instructorsMap.get(record.trainer.id)
      if (existing) {
        if (!existing.roleInCourse.includes(role)) {
          existing.roleInCourse.push(role)
        }
        return
      }

      instructorsMap.set(record.trainer.id, {
        id: record.trainer.id,
        eid: record.trainer.eid,
        firstName: record.trainer.firstName,
        middleName: record.trainer.middleName,
        lastName: record.trainer.lastName,
        email: record.trainer.email,
        phoneNumber: record.trainer.phoneNumber,
        status: record.trainer.status,
        roleInCourse: [role]
      })
    }

    courseInstructorRecords.forEach((record) => upsertInstructor(record))
    subjectInstructorRecords.forEach((record) => upsertInstructor(record))

    const instructors = Array.from(instructorsMap.values()).sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    )

    const { subjects, _count, ...courseData } = course

    return {
      ...courseData,
      subjectCount: _count.subjects,
      traineeCount,
      trainerCount: trainerIds.size,
      instructors,
      subjects
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

  async assignTrainerToCourse({
    courseId,
    trainerUserId,
    roleInSubject
  }: {
    courseId: string
    trainerUserId: string
    roleInSubject: SubjectInstructorRoleValue
  }): Promise<AssignCourseTrainerResType> {
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findFirst({
        where: {
          id: courseId,
          deletedAt: null,
          status: {
            not: CourseStatus.ARCHIVED
          }
        },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          departmentId: true
        }
      })

      if (!course) {
        throw CourseNotFoundException
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

      const assignment = await tx.courseInstructor.create({
        data: {
          trainerUserId,
          courseId,
          roleInAssessment: roleInSubject as any
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
          }
        }
      })

      return {
        trainer: assignment.trainer,
        course: {
          id: course.id,
          code: course.code,
          name: course.name,
          status: course.status,
          startDate: course.startDate,
          endDate: course.endDate
        },
        role: assignment.roleInAssessment as SubjectInstructorRoleValue
      }
    })
  }

  async updateCourseTrainerAssignment({
    courseId,
    trainerUserId,
    newRoleInSubject
  }: {
    courseId: string
    trainerUserId: string
    newRoleInSubject: SubjectInstructorRoleValue
  }): Promise<UpdateCourseTrainerAssignmentResType> {
    const assignment = await this.prisma.courseInstructor.update({
      where: {
        trainerUserId_courseId: {
          trainerUserId,
          courseId
        }
      },
      data: {
        roleInAssessment: newRoleInSubject as any
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
    })

    return {
      trainer: assignment.trainer,
      course: assignment.course,
      role: assignment.roleInAssessment as SubjectInstructorRoleValue
    }
  }

  async removeTrainerFromCourse({
    courseId,
    trainerUserId
  }: {
    courseId: string
    trainerUserId: string
  }): Promise<void> {
    await this.prisma.courseInstructor.delete({
      where: {
        trainerUserId_courseId: {
          trainerUserId,
          courseId
        }
      }
    })
  }

  async isTrainerAssignedToCourse({
    courseId,
    trainerUserId
  }: {
    courseId: string
    trainerUserId: string
  }): Promise<boolean> {
    const assignment = await this.prisma.courseInstructor.findUnique({
      where: {
        trainerUserId_courseId: {
          trainerUserId,
          courseId
        }
      }
    })

    return !!assignment
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

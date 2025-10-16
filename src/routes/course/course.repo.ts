import { Injectable } from '@nestjs/common'
import { SubjectEnrollmentStatus } from '@prisma/client'
import { CourseStatus } from '~/shared/constants/course.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { SharedSubjectEnrollmentRepository } from '~/shared/repositories/shared-subject-enrollment.repo'
import { SharedSubjectRepository } from '~/shared/repositories/shared-subject.repo'
import { PrismaService } from '~/shared/services/prisma.service'
import {
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
    console.log(trainees, trainees.length)

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

    const [traineeCount, trainerCount] = await Promise.all([
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
      this.prisma.subjectInstructor
        .findMany({
          where: {
            subject: {
              courseId: id,
              deletedAt: null
            }
          },
          select: {
            trainerUserId: true
          },
          distinct: ['trainerUserId']
        })
        .then((instructors) => instructors.length)
    ])

    const { subjects, _count, ...courseData } = course

    return {
      ...courseData,
      subjectCount: _count.subjects,
      traineeCount,
      trainerCount,
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

  async archive({ id, deletedById }: { id: string; deletedById: string }): Promise<CourseType> {
    return this.prisma.course.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById,
        status: CourseStatus.ARCHIVED,
        updatedById: deletedById,
        updatedAt: new Date()
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
      console.log('traineeMap', traineeMap.values())
      const current = traineeMap.get(enrollment.traineeUserId)
      if (!current) {
        continue
      }

      current.enrollmentCount += 1

      if (enrollment.batchCode) {
        current.batches.add(enrollment.batchCode)
      }
    }

    console.log(
      Array.from(traineeMap.values()).map(({ batches, ...info }) => ({
        ...info,
        batches: Array.from(batches)
      }))
    )

    return Array.from(traineeMap.values()).map(({ batches, ...info }) => ({
      ...info,
      batches: Array.from(batches)
    }))
  }
}

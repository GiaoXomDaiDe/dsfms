import { Injectable } from '@nestjs/common'
import {
  CannotArchiveCourseWithActiveSubjectsException,
  CannotArchiveCourseWithNonCancelledEnrollmentsException
} from '~/routes/course/course.error'
import {
  AssignCourseTrainerResType,
  CourseTraineeInfoType,
  CreateCourseBodyType,
  CreateCourseResType,
  GetCourseResType,
  GetCoursesResType,
  GetCourseTraineesResType,
  UpdateCourseBodyType,
  UpdateCourseResType,
  UpdateCourseTrainerRoleResType
} from '~/routes/course/course.model'
import { TrainerNotFoundException } from '~/routes/subject/subject.error'
import { SubjectEnrollmentTraineeSnapshotType } from '~/routes/subject/subject.model'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import { CourseStatus } from '~/shared/constants/course.constant'
import { SubjectEnrollmentStatus, SubjectInstructorRoleValue, SubjectStatus } from '~/shared/constants/subject.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { CourseType } from '~/shared/models/shared-course.model'
import {
  courseDepartmentSummarySelect,
  courseInstructorSummaryInclude,
  courseTrainerSummarySelect
} from '~/shared/prisma-presets/shared-course.prisma-presets'
import { SharedSubjectEnrollmentRepository } from '~/shared/repositories/shared-subject-enrollment.repo'
import { SharedSubjectRepository } from '~/shared/repositories/shared-subject.repo'
import { PrismaService } from '~/shared/services/prisma.service'

type TrainerInfo = {
  id: string
  eid: string
  firstName: string
  middleName: string | null
  lastName: string
  email: string
  phoneNumber: string | null
  status: (typeof UserStatus)[keyof typeof UserStatus]
}

type CourseInstructorSummary = TrainerInfo & {
  roleInCourse: SubjectInstructorRoleValue[]
}

@Injectable()
@SerializeAll(['aggregateeTraineesInCourse'])
export class CourseRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sharedSubjectRepo: SharedSubjectRepository,
    private readonly sharedSubjectEnrollmentRepo: SharedSubjectEnrollmentRepository
  ) {}

  async list(): Promise<GetCoursesResType> {
    const courses = await this.prismaService.course.findMany({
      where: {
        status: { not: CourseStatus.ARCHIVED },
        deletedAt: null
      },
      include: {
        department: {
          select: courseDepartmentSummarySelect
        },
        _count: {
          select: {
            subjects: {
              where: {
                deletedAt: null,
                status: { not: SubjectStatus.ARCHIVED }
              }
            }
          }
        }
      }
    })

    const formattedCourses = courses.map(({ _count, ...course }) => ({
      ...course,
      totalSubjects: _count.subjects
    }))

    return {
      courses: formattedCourses,
      totalItems: courses.length
    }
  }

  async findById(id: string): Promise<GetCourseResType | null> {
    const course = await this.prismaService.course.findFirst({
      where: {
        id,
        status: {
          not: CourseStatus.ARCHIVED
        },
        deletedAt: null
      },
      include: {
        department: {
          select: courseDepartmentSummarySelect
        },
        subjects: {
          where: {
            deletedAt: null,
            status: {
              not: SubjectStatus.ARCHIVED
            }
          }
        },
        _count: {
          select: {
            subjects: {
              where: {
                deletedAt: null,
                status: {
                  not: SubjectStatus.ARCHIVED
                }
              }
            }
          }
        }
      }
    })

    if (!course) return null

    const [traineeCount, courseInstructorRecords] = await Promise.all([
      this.prismaService.subjectEnrollment
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
      this.prismaService.courseInstructor.findMany({
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
            select: courseTrainerSummarySelect
          }
        }
      })
    ])

    const trainerIds = new Set<string>([...courseInstructorRecords.map((record) => record.trainerUserId)])

    const toTrainerInfo = (trainer: TrainerInfo): TrainerInfo => ({
      id: trainer.id,
      eid: trainer.eid,
      firstName: trainer.firstName,
      middleName: trainer.middleName,
      lastName: trainer.lastName,
      email: trainer.email,
      phoneNumber: trainer.phoneNumber,
      status: trainer.status
    })

    const courseInstructorMap = new Map<string, CourseInstructorSummary>()
    courseInstructorRecords.forEach((record) => {
      const trainer = record.trainer
      if (!trainer) {
        return
      }

      const role = record.roleInAssessment as SubjectInstructorRoleValue
      const existing = courseInstructorMap.get(trainer.id)
      if (existing) {
        if (!existing.roleInCourse.includes(role)) {
          existing.roleInCourse.push(role)
        }
        return
      }

      courseInstructorMap.set(trainer.id, {
        ...toTrainerInfo(trainer),
        roleInCourse: [role]
      })
    })

    const sortByName = (a: TrainerInfo, b: TrainerInfo) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)

    const instructors = Array.from(courseInstructorMap.values()).sort(sortByName)

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
    return this.prismaService.course.create({
      data: {
        ...data,
        createdById,
        updatedById: createdById
      },
      include: {
        department: {
          select: courseDepartmentSummarySelect
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
    return this.prismaService.course.update({
      where: { id },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      },
      include: {
        department: {
          select: courseDepartmentSummarySelect
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
      return await this.prismaService.$transaction(async (tx) => {
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
      return await this.prismaService.$transaction(async (tx) => {
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

    return this.prismaService.course.update({
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

  async assignTrainerToCourse({
    courseId,
    trainerUserId,
    roleInSubject
  }: {
    courseId: string
    trainerUserId: string
    roleInSubject: SubjectInstructorRoleValue
  }): Promise<AssignCourseTrainerResType> {
    return this.prismaService.$transaction(async (tx) => {
      const trainer = await tx.user.findUnique({
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
          roleInAssessment: roleInSubject
        },
        include: courseInstructorSummaryInclude
      })

      return {
        trainer: assignment.trainer,
        course: assignment.course,
        role: assignment.roleInAssessment
      }
    })
  }

  async updateCourseTrainerRole({
    courseId,
    trainerUserId,
    newRoleInSubject
  }: {
    courseId: string
    trainerUserId: string
    newRoleInSubject: SubjectInstructorRoleValue
  }): Promise<UpdateCourseTrainerRoleResType> {
    const assignment = await this.prismaService.courseInstructor.update({
      where: {
        trainerUserId_courseId: {
          trainerUserId,
          courseId
        }
      },
      data: {
        roleInAssessment: newRoleInSubject
      },
      include: courseInstructorSummaryInclude
    })

    return {
      trainer: assignment.trainer,
      course: assignment.course,
      role: assignment.roleInAssessment
    }
  }

  async removeTrainerFromCourse({
    courseId,
    trainerUserId
  }: {
    courseId: string
    trainerUserId: string
  }): Promise<void> {
    await this.prismaService.courseInstructor.delete({
      where: {
        trainerUserId_courseId: {
          trainerUserId,
          courseId
        }
      }
    })
  }

  async getTraineesInCourse({
    courseId,
    batchCode
  }: {
    courseId: string
    batchCode?: string
  }): Promise<GetCourseTraineesResType> {
    const subjectIds = await this.sharedSubjectRepo.findIds(courseId)

    if (subjectIds.length === 0) {
      return {
        trainees: [],
        totalItems: 0
      }
    }

    const enrollments = await this.sharedSubjectEnrollmentRepo.findTraineesBySubjectIds(subjectIds, {
      batchCode
    })

    const trainees = this.aggregateeTraineesInCourse(enrollments)

    return {
      trainees,
      totalItems: trainees.length
    }
  }

  async isTrainerAssignedToCourse({
    courseId,
    trainerUserId
  }: {
    courseId: string
    trainerUserId: string
  }): Promise<boolean> {
    const assignment = await this.prismaService.courseInstructor.findUnique({
      where: {
        trainerUserId_courseId: {
          trainerUserId,
          courseId
        }
      }
    })

    return !!assignment
  }

  private aggregateeTraineesInCourse(enrollments: SubjectEnrollmentTraineeSnapshotType[]): CourseTraineeInfoType[] {
    type TraineeAccumulator = Omit<CourseTraineeInfoType, 'subjectCount'> & { subjectIds: Set<string> }

    const traineeMap = new Map<string, TraineeAccumulator>()

    for (const enrollment of enrollments) {
      const trainee = enrollment.trainee
      if (!trainee) {
        continue
      }

      let acc = traineeMap.get(enrollment.traineeUserId)
      if (!acc) {
        acc = {
          id: trainee.id,
          eid: trainee.eid,
          firstName: trainee.firstName,
          middleName: trainee.middleName,
          lastName: trainee.lastName,
          email: trainee.email,
          subjectIds: new Set<string>()
        }
        traineeMap.set(enrollment.traineeUserId, acc)
      }

      acc.subjectIds.add(enrollment.subjectId)
    }

    return Array.from(traineeMap.values()).map(({ subjectIds, ...info }) => ({
      ...info,
      subjectCount: subjectIds.size
    }))
  }
}

import { Injectable } from '@nestjs/common'
import { RoleName } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  AddInstructorsBodyType,
  CreateSubjectBodyType,
  EnrollTraineesBodyType,
  GetSubjectsQueryType,
  GetSubjectsResType,
  SubjectDetailResType,
  SubjectEntityType,
  SubjectStatsType,
  SubjectWithInfoType,
  UpdateEnrollmentStatusBodyType,
  UpdateSubjectBodyType
} from './subject.model'

@Injectable()
export class SubjectRepo {
  constructor(private readonly prisma: PrismaService) {}

  async list({
    page = 1,
    limit = 10,
    search,
    courseId,
    method,
    type,
    isSIM,
    includeDeleted = false
  }: GetSubjectsQueryType): Promise<GetSubjectsResType> {
    const skip = (page - 1) * limit
    const whereClause: any = {}

    // Base filter for soft delete
    if (!includeDeleted) {
      whereClause.deletedAt = null
    }

    // Search filter
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Additional filters
    if (courseId) {
      whereClause.courseId = courseId
    }

    if (method) {
      whereClause.method = method
    }

    if (type) {
      whereClause.type = type
    }

    if (isSIM !== undefined) {
      whereClause.isSIM = isSIM
    }

    const [totalItems, subjectsWithInfo] = await Promise.all([
      this.prisma.subject.count({ where: whereClause }),
      this.prisma.subject.findMany({
        where: whereClause,
        include: {
          course: {
            select: {
              id: true,
              name: true,
              code: true,
              departmentId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              eid: true,
              firstName: true,
              lastName: true
            }
          },
          updatedBy: {
            select: {
              id: true,
              eid: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: {
              instructors: true,
              enrollments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ])

    const subjects = subjectsWithInfo.map(({ _count, ...subject }) => ({
      ...subject,
      instructorCount: _count.instructors,
      enrollmentCount: _count.enrollments
    })) as unknown as SubjectWithInfoType[]

    const totalPages = Math.ceil(totalItems / limit)

    return {
      subjects,
      totalItems,
      totalPages,
      currentPage: page
    }
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<SubjectDetailResType | null> {
    const whereClause = includeDeleted ? { id } : { id, deletedAt: null }

    const subject = await this.prisma.subject.findUnique({
      where: whereClause,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            departmentId: true,
            department: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true
          }
        },
        instructors: {
          include: {
            trainer: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                lastName: true
              }
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
                lastName: true
              }
            }
          }
        }
      }
    })

    if (!subject) return null

    return {
      ...subject,
      instructorCount: subject.instructors.length,
      enrollmentCount: subject.enrollments.length
    } as unknown as SubjectDetailResType
  }

  async create({
    data,
    createdById
  }: {
    data: CreateSubjectBodyType
    createdById: string
  }): Promise<SubjectEntityType> {
    return (await this.prisma.subject.create({
      data: {
        ...data,
        createdById,
        updatedById: createdById
      }
    })) as unknown as SubjectEntityType
  }

  async update({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateSubjectBodyType
    updatedById: string
  }): Promise<SubjectEntityType> {
    return (await this.prisma.subject.update({
      where: { id },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      }
    })) as unknown as SubjectEntityType
  }

  async delete({
    id,
    deletedById,
    isHard = false
  }: {
    id: string
    deletedById: string
    isHard?: boolean
  }): Promise<SubjectEntityType> {
    if (isHard) {
      return (await this.prisma.subject.delete({
        where: { id }
      })) as unknown as SubjectEntityType
    }

    return (await this.prisma.subject.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById
      }
    })) as unknown as SubjectEntityType
  }

  async restore({ id, restoredById }: { id: string; restoredById: string }): Promise<SubjectEntityType> {
    return (await this.prisma.subject.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null,
        updatedById: restoredById,
        updatedAt: new Date()
      }
    })) as unknown as SubjectEntityType
  }

  async addInstructors({
    subjectId,
    instructors
  }: {
    subjectId: string
    instructors: AddInstructorsBodyType['instructors']
  }): Promise<{ addedInstructors: string[]; duplicateInstructors: string[] }> {
    // Get trainer EIDs
    const trainerEids = instructors.map((inst) => inst.trainerEid)

    // Validate trainers exist and have TRAINER role
    const trainers = await this.prisma.user.findMany({
      where: {
        eid: { in: trainerEids },
        role: {
          name: RoleName.TRAINER
        },
        deletedAt: null
      },
      select: {
        id: true,
        eid: true
      }
    })

    const trainerMap = new Map(trainers.map((trainer) => [trainer.eid, trainer.id]))

    // Check for existing instructors
    const existingInstructors = await this.prisma.subjectInstructor.findMany({
      where: {
        subjectId,
        trainerUserId: { in: trainers.map((t) => t.id) }
      },
      select: {
        trainerUserId: true,
        trainer: {
          select: { eid: true }
        }
      }
    })

    const existingTrainerIds = new Set(existingInstructors.map((inst) => inst.trainerUserId))
    const duplicateInstructors = existingInstructors.map((inst) => inst.trainer.eid)

    // Prepare data for new instructors
    const newInstructorData = []
    const addedInstructors: string[] = []

    for (const instructor of instructors) {
      const trainerId = trainerMap.get(instructor.trainerEid)
      if (trainerId && !existingTrainerIds.has(trainerId)) {
        newInstructorData.push({
          subjectId,
          trainerUserId: trainerId,
          roleInSubject: instructor.roleInSubject
        })
        addedInstructors.push(instructor.trainerEid)
      }
    }

    // Create new instructors
    if (newInstructorData.length > 0) {
      await this.prisma.subjectInstructor.createMany({
        data: newInstructorData
      })
    }

    return {
      addedInstructors,
      duplicateInstructors
    }
  }

  async removeInstructors({
    subjectId,
    trainerEids
  }: {
    subjectId: string
    trainerEids: string[]
  }): Promise<{ removedInstructors: string[]; notFoundInstructors: string[] }> {
    // Get trainer IDs from EIDs
    const trainers = await this.prisma.user.findMany({
      where: {
        eid: { in: trainerEids },
        deletedAt: null
      },
      select: {
        id: true,
        eid: true
      }
    })

    const trainerMap = new Map(trainers.map((trainer) => [trainer.eid, trainer.id]))
    const trainerIds = trainers.map((t) => t.id)

    // Find existing instructors
    const existingInstructors = await this.prisma.subjectInstructor.findMany({
      where: {
        subjectId,
        trainerUserId: { in: trainerIds }
      },
      select: {
        trainerUserId: true,
        trainer: {
          select: { eid: true }
        }
      }
    })

    const existingTrainerIds = existingInstructors.map((inst) => inst.trainerUserId)
    const removedInstructors = existingInstructors.map((inst) => inst.trainer.eid)

    // Find not found instructors
    const notFoundInstructors = trainerEids.filter(
      (eid) => !trainerMap.has(eid) || !existingTrainerIds.includes(trainerMap.get(eid)!)
    )

    // Remove instructors
    if (existingTrainerIds.length > 0) {
      await this.prisma.subjectInstructor.deleteMany({
        where: {
          subjectId,
          trainerUserId: { in: existingTrainerIds }
        }
      })
    }

    return {
      removedInstructors,
      notFoundInstructors
    }
  }

  async enrollTrainees({
    subjectId,
    trainees
  }: {
    subjectId: string
    trainees: EnrollTraineesBodyType['trainees']
  }): Promise<{ enrolledTrainees: string[]; duplicateTrainees: string[] }> {
    // Get trainee EIDs
    const traineeEids = trainees.map((trainee) => trainee.traineeEid)

    // Validate trainees exist and have TRAINEE role
    const traineeUsers = await this.prisma.user.findMany({
      where: {
        eid: { in: traineeEids },
        role: {
          name: RoleName.TRAINEE
        },
        deletedAt: null
      },
      select: {
        id: true,
        eid: true
      }
    })

    const traineeMap = new Map(traineeUsers.map((trainee) => [trainee.eid, trainee.id]))

    // Check for existing enrollments
    const existingEnrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId,
        traineeUserId: { in: traineeUsers.map((t) => t.id) }
      },
      select: {
        traineeUserId: true,
        trainee: {
          select: { eid: true }
        }
      }
    })

    const existingTraineeIds = new Set(existingEnrollments.map((enr) => enr.traineeUserId))
    const duplicateTrainees = existingEnrollments.map((enr) => enr.trainee.eid)

    // Prepare data for new enrollments
    const newEnrollmentData = []
    const enrolledTrainees: string[] = []

    for (const trainee of trainees) {
      const traineeId = traineeMap.get(trainee.traineeEid)
      if (traineeId && !existingTraineeIds.has(traineeId)) {
        newEnrollmentData.push({
          subjectId,
          traineeUserId: traineeId,
          enrollmentDate: new Date(),
          batchCode: trainee.batchCode
        })
        enrolledTrainees.push(trainee.traineeEid)
      }
    }

    // Create new enrollments
    if (newEnrollmentData.length > 0) {
      await this.prisma.subjectEnrollment.createMany({
        data: newEnrollmentData
      })
    }

    return {
      enrolledTrainees,
      duplicateTrainees
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
    const trainees = await this.prisma.user.findMany({
      where: {
        eid: { in: traineeEids },
        deletedAt: null
      },
      select: {
        id: true,
        eid: true
      }
    })

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

  async updateEnrollmentStatus({
    subjectId,
    traineeEid,
    status
  }: {
    subjectId: string
    traineeEid: string
    status: UpdateEnrollmentStatusBodyType['status']
  }): Promise<boolean> {
    // Get trainee ID from EID
    const trainee = await this.prisma.user.findFirst({
      where: {
        eid: traineeEid,
        deletedAt: null
      },
      select: { id: true }
    })

    if (!trainee) return false

    // Update enrollment status
    const result = await this.prisma.subjectEnrollment.updateMany({
      where: {
        subjectId,
        traineeUserId: trainee.id
      },
      data: { status }
    })

    return result.count > 0
  }

  async checkCodeExists(code: string, excludeId?: string): Promise<boolean> {
    const whereClause: any = {
      code,
      deletedAt: null
    }

    if (excludeId) {
      whereClause.id = { not: excludeId }
    }

    const existingSubject = await this.prisma.subject.findFirst({
      where: whereClause
    })

    return !!existingSubject
  }

  async getStats({ includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<SubjectStatsType> {
    const whereClause = includeDeleted ? {} : { deletedAt: null }

    const [totalSubjects, methodStats, typeStats, courseStats] = await Promise.all([
      // Total subjects count
      this.prisma.subject.count({ where: whereClause }),

      // Subjects by method
      this.prisma.subject.groupBy({
        by: ['method'],
        where: whereClause,
        _count: true
      }),

      // Subjects by type
      this.prisma.subject.groupBy({
        by: ['type'],
        where: whereClause,
        _count: true
      }),

      // Subjects by course
      this.prisma.subject.groupBy({
        by: ['courseId'],
        where: whereClause,
        _count: true
      })
    ])

    // Get course names for statistics
    const courseIds = courseStats.map((stat) => stat.courseId)
    const courses = await this.prisma.course.findMany({
      where: {
        id: { in: courseIds }
      },
      select: {
        id: true,
        name: true
      }
    })

    const courseMap = new Map(courses.map((course) => [course.id, course.name]))

    return {
      totalSubjects,
      subjectsByMethod: methodStats.reduce(
        (acc, stat) => {
          acc[stat.method] = stat._count
          return acc
        },
        {} as Record<string, number>
      ),
      subjectsByType: typeStats.reduce(
        (acc, stat) => {
          acc[stat.type] = stat._count
          return acc
        },
        {} as Record<string, number>
      ),
      subjectsByCourse: courseStats.map((stat) => ({
        courseId: stat.courseId,
        courseName: courseMap.get(stat.courseId) || 'Unknown',
        count: stat._count
      }))
    }
  }
}

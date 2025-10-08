import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  CourseDetailResType,
  CourseType,
  CourseWithInfoType,
  CreateCourseBodyType,
  GetCoursesQueryType,
  GetCoursesResType,
  UpdateCourseBodyType
} from './course.model'

@Injectable()
export class CourseRepo {
  constructor(private readonly prisma: PrismaService) {}

  async list({
    page = 1,
    limit = 10,
    search,
    departmentId,
    level,
    status,
    courseIds,
    includeDeleted = false
  }: GetCoursesQueryType): Promise<GetCoursesResType> {
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
    if (departmentId) {
      whereClause.departmentId = departmentId
    }

    if (level) {
      whereClause.level = level
    }

    if (status) {
      whereClause.status = status
    }

    if (courseIds && courseIds.length > 0) {
      whereClause.id = { in: courseIds }
    }

    const [totalItems, coursesWithCount] = await Promise.all([
      this.prisma.course.count({ where: whereClause }),
      this.prisma.course.findMany({
        where: whereClause,
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true
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
              subjects: {
                where: {
                  deletedAt: null
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ])

    // Get course IDs for statistics
    const resultCourseIds = coursesWithCount.map((c) => c.id)

    // Calculate trainee and trainer counts for all courses
    const [traineeStats, trainerStats] = await Promise.all([
      // Get trainee counts
      this.prisma.subjectEnrollment.groupBy({
        by: ['subjectId'],
        where: {
          subject: {
            courseId: { in: resultCourseIds },
            deletedAt: null
          }
        },
        _count: {
          traineeUserId: true
        }
      }),
      // Get trainer counts
      this.prisma.subjectInstructor.groupBy({
        by: ['subjectId'],
        where: {
          subject: {
            courseId: { in: resultCourseIds },
            deletedAt: null
          }
        },
        _count: {
          trainerUserId: true
        }
      })
    ])

    // Get subject to course mapping for statistics
    const subjectToCourse = await this.prisma.subject.findMany({
      where: {
        courseId: { in: resultCourseIds },
        deletedAt: null
      },
      select: {
        id: true,
        courseId: true
      }
    })

    // Build maps for quick lookup
    const traineeCountMap = new Map<string, number>()
    const trainerCountMap = new Map<string, number>()

    traineeStats.forEach((stat) => {
      const subject = subjectToCourse.find((s) => s.id === stat.subjectId)
      if (subject && subject.courseId) {
        const currentCount = traineeCountMap.get(subject.courseId) || 0
        traineeCountMap.set(subject.courseId, currentCount + stat._count.traineeUserId)
      }
    })

    trainerStats.forEach((stat) => {
      const subject = subjectToCourse.find((s) => s.id === stat.subjectId)
      if (subject && subject.courseId) {
        const currentCount = trainerCountMap.get(subject.courseId) || 0
        trainerCountMap.set(subject.courseId, currentCount + stat._count.trainerUserId)
      }
    })

    const courses = coursesWithCount.map(({ _count, ...course }) => ({
      ...course,
      subjectCount: _count.subjects,
      traineeCount: traineeCountMap.get(course.id) || 0,
      trainerCount: trainerCountMap.get(course.id) || 0
    })) as unknown as CourseWithInfoType[]

    const totalPages = Math.ceil(totalItems / limit)

    return {
      courses,
      totalItems,
      totalPages,
      currentPage: page
    }
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<CourseDetailResType | null> {
    const whereClause = includeDeleted ? { id } : { id, deletedAt: null }

    const course = await this.prisma.course.findUnique({
      where: whereClause,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
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
        subjects: {
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true,
            code: true,
            method: true,
            duration: true,
            type: true,
            roomName: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            createdAt: 'desc'
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

    // Get detailed statistics for this course
    const [traineeCount, trainerCount] = await Promise.all([
      // Count unique trainees enrolled in course subjects
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
      // Count unique trainers assigned to course subjects
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

    // Transform subjects from course include
    const subjectSummaries = course.subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      method: subject.method,
      duration: subject.duration,
      type: subject.type,
      roomName: subject.roomName,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString()
    }))

    const { subjects, _count, ...courseData } = course

    return {
      ...courseData,
      subjectCount: _count.subjects,
      traineeCount,
      trainerCount,
      subjects: subjectSummaries
    } as unknown as CourseDetailResType
  }

  async create({ data, createdById }: { data: CreateCourseBodyType; createdById: string }): Promise<CourseType> {
    return (await this.prisma.course.create({
      data: {
        ...data,
        createdById,
        updatedById: createdById
      }
    })) as unknown as CourseType
  }

  async update({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateCourseBodyType
    updatedById: string
  }): Promise<CourseType> {
    return (await this.prisma.course.update({
      where: { id },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      }
    })) as unknown as CourseType
  }

  async delete({
    id,
    deletedById,
    isHard = false
  }: {
    id: string
    deletedById: string
    isHard?: boolean
  }): Promise<CourseType> {
    if (isHard) {
      return (await this.prisma.course.delete({
        where: { id }
      })) as unknown as CourseType
    }

    return (await this.prisma.course.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById
      }
    })) as unknown as CourseType
  }

  async restore({ id, restoredById }: { id: string; restoredById: string }): Promise<CourseType> {
    return (await this.prisma.course.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null,
        updatedById: restoredById,
        updatedAt: new Date()
      }
    })) as unknown as CourseType
  }

  async checkCodeExists(code: string, excludeId?: string): Promise<boolean> {
    const whereClause: any = {
      code,
      deletedAt: null
    }

    if (excludeId) {
      whereClause.id = { not: excludeId }
    }

    const existingCourse = await this.prisma.course.findFirst({
      where: whereClause
    })

    return !!existingCourse
  }
}

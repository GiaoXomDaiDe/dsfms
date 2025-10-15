import { Injectable } from '@nestjs/common'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  CourseType,
  CreateCourseBodyType,
  GetCourseResType,
  GetCoursesQueryType,
  GetCoursesResType,
  UpdateCourseBodyType
} from './course.model'

@Injectable()
export class CourseRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sharedUserRepository: SharedUserRepository
  ) {}

  async list({ includeDeleted = false }: GetCoursesQueryType): Promise<GetCoursesResType> {
    const whereClause = this.sharedUserRepository.buildListFilters({ includeDeleted })

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

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<GetCourseResType | null> {
    const whereClause = includeDeleted ? { id } : { id, deletedAt: null }

    const course = await this.prisma.course.findUnique({
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

  async create({ data, createdById }: { data: CreateCourseBodyType; createdById: string }): Promise<CourseType> {
    const course = await this.prisma.course.create({
      data: {
        ...data,
        createdById,
        updatedById: createdById
      }
    })

    return {
      ...course,
      startDate: course.startDate.toISOString(),
      endDate: course.endDate.toISOString(),
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      deletedAt: course.deletedAt?.toISOString() || null
    } as unknown as CourseType
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
    const course = await this.prisma.course.update({
      where: { id },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      }
    })

    return {
      ...course,
      startDate: course.startDate.toISOString(),
      endDate: course.endDate.toISOString(),
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      deletedAt: course.deletedAt?.toISOString() || null
    } as unknown as CourseType
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
      const course = await this.prisma.course.delete({
        where: { id }
      })
      return {
        ...course,
        startDate: course.startDate.toISOString(),
        endDate: course.endDate.toISOString(),
        createdAt: course.createdAt.toISOString(),
        updatedAt: course.updatedAt.toISOString(),
        deletedAt: course.deletedAt?.toISOString() || null
      } as unknown as CourseType
    }

    const course = await this.prisma.course.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById
      }
    })

    return {
      ...course,
      startDate: course.startDate.toISOString(),
      endDate: course.endDate.toISOString(),
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      deletedAt: course.deletedAt?.toISOString() || null
    } as unknown as CourseType
  }

  async restore({ id, restoredById }: { id: string; restoredById: string }): Promise<CourseType> {
    const course = await this.prisma.course.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null,
        updatedById: restoredById,
        updatedAt: new Date()
      }
    })

    return {
      ...course,
      startDate: course.startDate.toISOString(),
      endDate: course.endDate.toISOString(),
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      deletedAt: course.deletedAt?.toISOString() || null
    } as unknown as CourseType
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

import { Injectable } from '@nestjs/common'
import {
  CreateDepartmentBodyType,
  DepartmentDetailResType,
  DepartmentType,
  GetDepartmentsResType,
  UpdateDepartmentBodyType
} from '~/routes/department/department.model'
import { STATUS_CONST } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class DepartmentRepo {
  constructor(private readonly prisma: PrismaService) {}

  async list({ includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<GetDepartmentsResType> {
    const whereClause = includeDeleted ? {} : { deletedAt: null }

    const [totalItems, departments] = await Promise.all([
      this.prisma.department.count({
        where: whereClause
      }),
      this.prisma.department.findMany({
        where: whereClause,
        include: {
          headUser: {
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
              role: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ])

    // Format departments data with proper date strings
    const formattedDepartments = departments.map((dept) => ({
      ...dept,
      createdAt: dept.createdAt.toISOString(),
      updatedAt: dept.updatedAt.toISOString(),
      deletedAt: dept.deletedAt?.toISOString() || null
    }))

    return {
      departments: formattedDepartments,
      totalItems
    }
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<DepartmentDetailResType | null> {
    const whereClause = includeDeleted ? { id } : { id, deletedAt: null }

    const department = await this.prisma.department.findUnique({
      where: whereClause,
      include: {
        headUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            email: true,
            role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            courses: {
              where: {
                deletedAt: null
              }
            }
          }
        }
      }
    })

    if (!department) return null

    // Complex logic: Get trainee count through department → courses → subjects → enrollments
    const traineeCount = await this.getTraineeCountByDepartment(id)

    // Complex logic: Get trainer count through department → courses → subjects → instructors
    const trainerCountResult = await this.getTrainerCountByDepartment(id)
    const trainerCount = trainerCountResult.count

    // Get ALL trainers của department này (for detailed info)
    const trainers = await this.prisma.user.findMany({
      where: {
        id: { in: trainerCountResult.trainerIds },
        deletedAt: null
      },
      omit: {
        passwordHash: true,
        signatureImageUrl: true
      }
    })

    // Get ALL courses of this department
    const courses = await this.prisma.course.findMany({
      where: {
        departmentId: id,
        deletedAt: null
      },
      include: {
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

    // Format courses data with subject count
    const formattedCourses = courses.map(({ _count, ...course }) => ({
      ...course,
      startDate: course.startDate?.toISOString() || null,
      endDate: course.endDate?.toISOString() || null,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      subjectCount: _count.subjects
    }))

    const { _count, ...departmentData } = department
    return {
      ...departmentData,
      createdAt: departmentData.createdAt.toISOString(),
      updatedAt: departmentData.updatedAt.toISOString(),
      deletedAt: departmentData.deletedAt?.toISOString() || null,
      courseCount: _count.courses,
      traineeCount,
      trainerCount,
      trainers,
      courses: formattedCourses
    }
  }

  async create({
    data,
    createdById
  }: {
    data: CreateDepartmentBodyType
    createdById: string | null
  }): Promise<DepartmentType> {
    return await this.prisma.department.create({
      data: {
        ...data,
        createdById
      }
    })
  }

  async update({
    id,
    updatedById,
    data
  }: {
    id: string
    updatedById: string
    data: UpdateDepartmentBodyType
  }): Promise<DepartmentType> {
    return await this.prisma.department.update({
      where: {
        id,
        deletedAt: null
      },
      data: {
        ...data,
        updatedById
      },
      include: {
        headUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })
  }

  delete(
    {
      id,
      deletedById
    }: {
      id: string
      deletedById: string
    },
    isHard?: boolean
  ): Promise<DepartmentType> {
    return isHard
      ? this.prisma.department.delete({
          where: {
            id
          }
        })
      : this.prisma.department.update({
          where: {
            id,
            deletedAt: null
          },
          data: {
            deletedAt: new Date(),
            deletedById,
            isActive: STATUS_CONST.INACTIVE
          }
        })
  }

  async enable({ id, enabledById }: { id: string; enabledById: string }): Promise<DepartmentType> {
    return this.prisma.department.update({
      where: {
        id,
        deletedAt: { not: null }
      },
      data: {
        deletedAt: null,
        deletedById: null,
        isActive: STATUS_CONST.ACTIVE,
        updatedById: enabledById
      }
    })
  }

  /**
   * Get unique trainee count for a department through:
   * Department → Courses → Subjects → SubjectEnrollments
   */
  private async getTraineeCountByDepartment(departmentId: string): Promise<number> {
    const result = await this.prisma.subjectEnrollment.findMany({
      where: {
        subject: {
          course: {
            departmentId,
            deletedAt: null
          },
          deletedAt: null
        }
      },
      select: {
        traineeUserId: true
      },
      distinct: ['traineeUserId']
    })

    return result.length
  }

  /**
   * Get unique trainer count and IDs for a department through:
   * Department → Courses → Subjects → SubjectInstructors
   */
  private async getTrainerCountByDepartment(departmentId: string): Promise<{ count: number; trainerIds: string[] }> {
    const result = await this.prisma.subjectInstructor.findMany({
      where: {
        subject: {
          course: {
            departmentId,
            deletedAt: null
          },
          deletedAt: null
        }
      },
      select: {
        trainerUserId: true
      },
      distinct: ['trainerUserId']
    })

    const trainerIds = result.map((r) => r.trainerUserId)
    return {
      count: trainerIds.length,
      trainerIds
    }
  }
}

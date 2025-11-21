import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  CreateDepartmentBodyType,
  DepartmentDetailResType,
  DepartmentType,
  GetDepartmentsResType,
  UpdateDepartmentBodyType
} from '~/routes/department/department.model'
import { RoleName } from '~/shared/constants/auth.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { SharedFilterService } from '~/shared/repositories/shared-filter.service'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll(['getClient'])
export class DepartmentRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sharedFilterService: SharedFilterService
  ) {}

  async list({ includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<GetDepartmentsResType> {
    const whereClause = this.sharedFilterService.buildListFilters({ includeDeleted })

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

    const departmentsWithStats = await Promise.all(
      departments.map(async (department) => {
        const { courseCount, traineeCount, trainerCount } = await this.getDepartmentStats(department.id)

        return {
          ...department,
          courseCount,
          traineeCount,
          trainerCount
        }
      })
    )

    return {
      departments: departmentsWithStats,
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
        }
      }
    })

    if (!department) return null

    const { courseCount, traineeCount, trainerCount, trainerIds } = await this.getDepartmentStats(id)

    // Get ALL trainers của department này (for detailed info)
    const trainers = await this.prisma.user.findMany({
      where: {
        id: { in: trainerIds },
        deletedAt: null,
        status: {
          notIn: ['DISABLED']
        }
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
      subjectCount: _count.subjects
    }))

    return {
      ...department,
      courseCount,
      traineeCount,
      trainerCount,
      trainers,
      courses: formattedCourses
    }
  }

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma
  }

  async create(
    {
      data,
      createdById
    }: {
      data: CreateDepartmentBodyType
      createdById: string | null
    },
    tx?: Prisma.TransactionClient
  ): Promise<DepartmentType> {
    const client = this.getClient(tx)

    return client.department.create({
      data: {
        ...data,
        createdById
      }
    })
  }

  async update(
    {
      id,
      data,
      updatedById
    }: {
      id: string
      data: UpdateDepartmentBodyType
      updatedById: string
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = this.getClient(tx)

    return client.department.update({
      where: { id },
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
            isActive: false
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
        isActive: true,
        updatedById: enabledById
      }
    })
  }

  async getDepartmentHeads() {
    const baseWhere = {
      role: {
        name: RoleName.DEPARTMENT_HEAD
      },
      deletedAt: null,
      departmentId: null
    }

    const [totalItems, users] = await Promise.all([
      this.prisma.user.count({
        where: baseWhere
      }),
      this.prisma.user.findMany({
        where: baseWhere,
        select: {
          id: true,
          eid: true,
          firstName: true,
          lastName: true,
          email: true
        },
        orderBy: {
          eid: 'asc'
        }
      })
    ])

    return {
      users,
      totalItems,
      infoMessage: totalItems === 0 ? 'No department heads available currently.' : undefined
    }
  }

  private async getDepartmentStats(departmentId: string) {
    const [courseCount, traineeCount, trainerResult] = await Promise.all([
      this.getCourseCountByDepartment(departmentId),
      this.getTraineeCountByDepartment(departmentId),
      this.getTrainerCountByDepartment(departmentId)
    ])

    return {
      courseCount,
      traineeCount,
      trainerCount: trainerResult.count,
      trainerIds: trainerResult.trainerIds
    }
  }

  private async getCourseCountByDepartment(departmentId: string): Promise<number> {
    return this.prisma.course.count({
      where: {
        departmentId,
        deletedAt: null,
        status: {
          notIn: ['ARCHIVED']
        }
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
            deletedAt: null,
            status: {
              notIn: ['ARCHIVED']
            }
          },
          deletedAt: null,
          status: {
            notIn: ['ARCHIVED']
          }
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
            deletedAt: null,
            status: {
              notIn: ['ARCHIVED']
            }
          },
          deletedAt: null,
          status: {
            notIn: ['ARCHIVED']
          }
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

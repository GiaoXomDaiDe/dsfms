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
export class DepartmentRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sharedFilterService: SharedFilterService
  ) {}

  async list({ includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<GetDepartmentsResType> {
    const whereClause = this.sharedFilterService.buildListFilters({ includeDeleted })

    const [totalItems, departments] = await Promise.all([
      this.prismaService.department.count({
        where: whereClause
      }),
      this.prismaService.department.findMany({
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
        const courseCount = await this.getCourseCountByDepartment(department.id)

        return {
          ...department,
          courseCount
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

    const department = await this.prismaService.department.findUnique({
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

    const courseCount = await this.getCourseCountByDepartment(id)

    // Get ALL courses of this department
    const courses = await this.prismaService.course.findMany({
      where: {
        departmentId: id,
        deletedAt: null,
        status: {
          notIn: ['ARCHIVED']
        }
      },
      include: {
        subjects: {
          where: {
            deletedAt: null,
            status: {
              notIn: ['ARCHIVED']
            }
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

    // Format courses data with subject count
    const formattedCourses = courses.map(({ _count, subjects, ...course }) => ({
      ...course,
      subjectCount: _count.subjects,
      subjects
    }))

    return {
      ...department,
      courseCount,
      courses: formattedCourses
    }
  }

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService
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
      ? this.prismaService.department.delete({
          where: {
            id
          }
        })
      : this.prismaService.department.update({
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
    return this.prismaService.department.update({
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
      this.prismaService.user.count({
        where: baseWhere
      }),
      this.prismaService.user.findMany({
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

  private async getCourseCountByDepartment(departmentId: string): Promise<number> {
    return this.prismaService.course.count({
      where: {
        departmentId,
        deletedAt: null,
        status: {
          notIn: ['ARCHIVED']
        }
      }
    })
  }
}

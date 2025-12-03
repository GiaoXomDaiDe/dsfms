import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  CreateDepartmentBodyType,
  DepartmentDetailResType,
  DepartmentType,
  GetDepartmentHeadsResType,
  GetDepartmentsResType,
  UpdateDepartmentBodyType
} from '~/routes/department/department.model'
import { RoleName, UserStatus } from '~/shared/constants/auth.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import {
  departmentWithHeadBasicInclude,
  departmentWithHeadInclude
} from '~/shared/prisma-presets/shared-department.prisma-presets'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll(['getClient'])
export class DepartmentRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async list(): Promise<GetDepartmentsResType> {
    const whereClause = {}

    const departments = await this.prismaService.department.findMany({
      where: whereClause,
      include: departmentWithHeadInclude
    })

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
      totalItems: departmentsWithStats.length
    }
  }

  async findById(id: string): Promise<DepartmentDetailResType | null> {
    const department = await this.prismaService.department.findUnique({
      where: { id },
      include: departmentWithHeadInclude
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
                deletedAt: null,
                status: {
                  notIn: ['ARCHIVED']
                }
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
        createdById,
        createdAt: new Date()
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
  ): Promise<DepartmentType> {
    const client = this.getClient(tx)

    return client.department.update({
      where: { id },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      },
      include: departmentWithHeadBasicInclude
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
            deletedAt: null,
            isActive: true
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
        id
      },
      data: {
        deletedAt: null,
        deletedById: null,
        isActive: true,
        updatedById: enabledById,
        updatedAt: new Date()
      }
    })
  }

  async getDepartmentHeads(): Promise<GetDepartmentHeadsResType> {
    const baseWhere = {
      role: {
        name: RoleName.DEPARTMENT_HEAD
      },
      status: UserStatus.ACTIVE,
      deletedAt: null,
      departmentId: null
    }

    const users = await this.prismaService.user.findMany({
      where: baseWhere,
      select: {
        id: true,
        eid: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true
      },
      orderBy: {
        eid: 'asc'
      }
    })

    return {
      users,
      totalItems: users.length,
      infoMessage: users.length === 0 ? 'No department heads available currently.' : undefined
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

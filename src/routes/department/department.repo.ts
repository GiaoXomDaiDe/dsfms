import { Injectable } from '@nestjs/common'
import {
  CreateDepartmentBodyType,
  DepartmentDetailResType,
  DepartmentType,
  GetDepartmentsResType,
  UpdateDepartmentBodyType
} from '~/routes/department/department.model'
import { RoleName, STATUS_CONST } from '~/shared/constants/auth.constant'
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
              lastName: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ])

    return {
      departments,
      totalItems
    }
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<DepartmentDetailResType | null> {
    const whereClause = includeDeleted ? { id } : { id, deletedAt: null }

    // Get department basic info
    const department = await this.prisma.department.findUnique({
      where: whereClause,
      include: {
        headUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
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

    // Trainee count logic chưa có - tạm thời set = 0
    const traineeCount = 0

    // Get ALL trainers of this department and count them
    const trainers = await this.prisma.user.findMany({
      where: {
        departmentId: id,
        role: {
          name: RoleName.TRAINER
        },
        deletedAt: null
      },
      select: {
        id: true,
        eid: true,
        firstName: true,
        middleName: true,
        lastName: true,
        address: true,
        avatarUrl: true,
        gender: true,
        status: true,
        email: true,
        phoneNumber: true
      },
      orderBy: {
        firstName: 'asc'
      }
    })

    const { _count, ...departmentData } = department
    return {
      ...departmentData,
      courseCount: _count.courses,
      traineeCount,
      trainerCount: trainers.length,
      trainers
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
}

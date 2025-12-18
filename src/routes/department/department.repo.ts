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
import { SubjectEnrollmentStatus, SubjectStatus } from '~/shared/constants/subject.constant'
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
      include: departmentWithHeadInclude,
      orderBy: {
        code: 'asc'
      }
    })

    const departmentsWithStats = await Promise.all(
      departments.map(async (department) => {
        const stats = await this.getDepartmentStats(department.id)

        return {
          ...department,
          courseCount: stats.courseCount,
          trainerCount: stats.trainerCount,
          traineeCount: stats.traineeCount
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

    const stats = await this.getDepartmentStats(id)

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
      courseCount: stats.courseCount,
      trainerCount: stats.trainerCount,
      traineeCount: stats.traineeCount,
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

  private async getDepartmentStats(departmentId: string): Promise<{
    courseCount: number
    trainerCount: number
    traineeCount: number
  }> {
    const courses = await this.prismaService.course.findMany({
      where: {
        departmentId,
        deletedAt: null,
        status: {
          notIn: ['ARCHIVED']
        }
      },
      select: {
        id: true
      }
    })

    const courseIds = courses.map((course) => course.id)

    if (courseIds.length === 0) {
      return {
        courseCount: 0,
        trainerCount: 0,
        traineeCount: 0
      }
    }

    const subjects = await this.prismaService.subject.findMany({
      where: {
        courseId: { in: courseIds },
        deletedAt: null,
        status: {
          notIn: [SubjectStatus.ARCHIVED]
        }
      },
      select: {
        id: true
      }
    })

    const subjectIds = subjects.map((subject) => subject.id)

    const [courseInstructorIds, subjectInstructorIds, traineeIds] = await Promise.all([
      this.prismaService.courseInstructor.findMany({
        where: {
          courseId: { in: courseIds },
          trainer: {
            deletedAt: null,
            status: UserStatus.ACTIVE
          }
        },
        select: { trainerUserId: true },
        distinct: ['trainerUserId']
      }),
      subjectIds.length > 0
        ? this.prismaService.subjectInstructor.findMany({
            where: {
              subjectId: { in: subjectIds },
              trainer: {
                deletedAt: null,
                status: UserStatus.ACTIVE
              }
            },
            select: { trainerUserId: true },
            distinct: ['trainerUserId']
          })
        : Promise.resolve<Array<{ trainerUserId: string | null }>>([]),
      subjectIds.length > 0
        ? this.prismaService.subjectEnrollment.findMany({
            where: {
              subjectId: { in: subjectIds },
              status: {
                not: SubjectEnrollmentStatus.CANCELLED
              },
              trainee: {
                deletedAt: null,
                status: UserStatus.ACTIVE
              }
            },
            select: { traineeUserId: true },
            distinct: ['traineeUserId']
          })
        : Promise.resolve<Array<{ traineeUserId: string | null }>>([])
    ])

    const trainerIdSet = new Set<string>()
    courseInstructorIds.forEach((i) => i.trainerUserId && trainerIdSet.add(i.trainerUserId))
    subjectInstructorIds.forEach((i) => i.trainerUserId && trainerIdSet.add(i.trainerUserId))

    const traineeIdSet = new Set<string>()
    traineeIds.forEach((t) => t.traineeUserId && traineeIdSet.add(t.traineeUserId))

    return {
      courseCount: courseIds.length,
      trainerCount: trainerIdSet.size,
      traineeCount: traineeIdSet.size
    }
  }
}

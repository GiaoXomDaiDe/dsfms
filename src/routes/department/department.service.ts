import { Injectable } from '@nestjs/common'
import { DepartmentAlreadyExistsException, NotFoundDepartmentException } from '~/routes/department/department.error'
import { CreateDepartmentBodyType, UpdateDepartmentBodyType } from '~/routes/department/department.model'
import { DepartmentRepo } from '~/routes/department/department.repo'
import { RoleName } from '~/shared/constants/auth.constant'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '~/shared/helper'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class DepartmentService {
  constructor(
    private readonly departmentRepo: DepartmentRepo,
    private readonly prisma: PrismaService
  ) {}

  async list({ includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}) {
    // Chỉ admin mới có thể xem các department đã bị xóa mềm
    const canViewDeleted = userRole === RoleName.ADMINISTRATOR
    return await this.departmentRepo.list({
      includeDeleted: canViewDeleted ? includeDeleted : false
    })
  }

  async findById(
    id: string,
    { includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}
  ) {
    try {
      // Chỉ admin mới có thể xem detail của department đã bị xóa mềm
      const canViewDeleted = userRole === RoleName.ADMINISTRATOR
      const department = await this.departmentRepo.findById(id, {
        includeDeleted: canViewDeleted ? includeDeleted : false
      })

      if (!department) {
        throw NotFoundDepartmentException
      }

      return department
    } catch (error) {
      throw NotFoundDepartmentException
    }
  }

  async create({ data, createdById }: { data: CreateDepartmentBodyType; createdById: string }) {
    try {
      return await this.departmentRepo.create({
        createdById,
        data
      })
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw DepartmentAlreadyExistsException
      }
      throw error
    }
  }

  async update({ id, data, updatedById }: { id: string; data: UpdateDepartmentBodyType; updatedById: string }) {
    try {
      const department = await this.departmentRepo.update({
        id,
        updatedById,
        data
      })
      return department
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundDepartmentException
      }
      if (isUniqueConstraintPrismaError(error)) {
        throw DepartmentAlreadyExistsException
      }
      throw error
    }
  }

  async delete({ id, deletedById }: { id: string; deletedById: string }) {
    try {
      await this.departmentRepo.delete({
        id,
        deletedById
      })
      return {
        message: 'Delete successfully'
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundDepartmentException
      }
      throw error
    }
  }

  async enable({ id, enabledById, enablerRole }: { id: string; enabledById: string; enablerRole: string }) {
    // Chỉ admin mới có thể enable department
    if (enablerRole !== RoleName.ADMINISTRATOR) {
      throw new Error('Only administrators can enable departments')
    }

    try {
      const department = await this.departmentRepo.findById(id, { includeDeleted: true })
      if (!department) {
        throw NotFoundDepartmentException
      }

      if (!department.deletedAt) {
        throw new Error('Department is not disabled')
      }

      return this.departmentRepo.enable({ id, enabledById })
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundDepartmentException
      }
      throw error
    }
  }

  // Get all users with Department Head role
  async getDepartmentHeads() {
    const [totalItems, users] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: {
            name: RoleName.DEPARTMENT_HEAD
          },
          deletedAt: null
        }
      }),
      this.prisma.user.findMany({
        where: {
          role: {
            name: RoleName.DEPARTMENT_HEAD
          },
          deletedAt: null
        },
        select: {
          id: true,
          eid: true,
          firstName: true,
          lastName: true,
          email: true
        },
        orderBy: {
          firstName: 'asc'
        }
      })
    ])

    return {
      users,
      totalItems
    }
  }

  // Add trainers to department by EID
  async addTrainersToDepartment({
    departmentId,
    trainerEids,
    updatedById
  }: {
    departmentId: string
    trainerEids: string[]
    updatedById: string
  }) {
    try {
      // Check if department exists
      const department = await this.departmentRepo.findById(departmentId)
      if (!department) {
        throw NotFoundDepartmentException
      }

      // Find trainers by EID and check if they have TRAINER role
      const trainers = await this.prisma.user.findMany({
        where: {
          eid: {
            in: trainerEids
          },
          role: {
            name: RoleName.TRAINER
          },
          deletedAt: null
        }
      })

      if (trainers.length !== trainerEids.length) {
        const foundEids = trainers.map((t) => t.eid)
        const notFoundEids = trainerEids.filter((eid) => !foundEids.includes(eid))
        throw new Error(`Trainers not found or not have TRAINER role: ${notFoundEids.join(', ')}`)
      }

      // Update trainers' departmentId
      await this.prisma.user.updateMany({
        where: {
          id: {
            in: trainers.map((t) => t.id)
          }
        },
        data: {
          departmentId,
          updatedById
        }
      })

      return {
        message: `Successfully added ${trainers.length} trainers to department`,
        addedTrainers: trainers.map((t) => ({
          eid: t.eid,
          name: `${t.firstName} ${t.lastName}`,
          email: t.email
        }))
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundDepartmentException
      }
      throw error
    }
  }
}

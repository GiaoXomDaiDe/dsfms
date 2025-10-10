import { BadRequestException, Injectable } from '@nestjs/common'
import { DepartmentAlreadyExistsException, NotFoundDepartmentException } from '~/routes/department/department.error'
import { CreateDepartmentBodyType, UpdateDepartmentBodyType } from '~/routes/department/department.model'
import { DepartmentRepo } from '~/routes/department/department.repo'
import { RoleName } from '~/shared/constants/auth.constant'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '~/shared/helper'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class DepartmentService {
  constructor(
    private readonly departmentRepo: DepartmentRepo,
    private readonly prisma: PrismaService,
    private readonly sharedUserRepo: SharedUserRepository
  ) {}

  async list({ includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}) {
    return await this.departmentRepo.list({
      includeDeleted: userRole === RoleName.ADMINISTRATOR ? includeDeleted : false
    })
  }

  async findById(
    id: string,
    { includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}
  ) {
    try {
      const department = await this.departmentRepo.findById(id, {
        includeDeleted: userRole === RoleName.ADMINISTRATOR ? includeDeleted : false
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
    // Validate headUserId has DEPARTMENT_HEAD role if provided
    if (data.headUserId) {
      await this.validateDepartmentHead(data.headUserId)
    }

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
    // Validate headUserId has DEPARTMENT_HEAD role if provided
    if (data.headUserId) {
      await this.validateDepartmentHead(data.headUserId)
    }

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
        message: 'Disable successfully'
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
        throw new Error('Department is already active')
      }

      await this.departmentRepo.enable({ id, enabledById })

      return {
        message: 'Enable department successfully'
      }
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

      // Check if any trainer already belongs to this department
      const trainersAlreadyInDepartment = trainers.filter((t) => t.departmentId === departmentId)
      if (trainersAlreadyInDepartment.length > 0) {
        const alreadyAssignedEids = trainersAlreadyInDepartment.map((t) => t.eid)
        throw new BadRequestException(`Trainers already belong to this department: ${alreadyAssignedEids.join(', ')}`)
      }

      // Check if any trainer already belongs to another department
      const trainersInOtherDepartments = trainers.filter((t) => t.departmentId && t.departmentId !== departmentId)
      if (trainersInOtherDepartments.length > 0) {
        const assignedToOtherDeptEids = trainersInOtherDepartments.map((t) => t.eid)
        throw new BadRequestException(
          `Trainers already belong to other departments: ${assignedToOtherDeptEids.join(', ')}`
        )
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

  // Remove trainers from department by EID
  async removeTrainersFromDepartment({
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

      // Find trainers by EID who belong to this department
      const trainers = await this.prisma.user.findMany({
        where: {
          eid: {
            in: trainerEids
          },
          role: {
            name: RoleName.TRAINER
          },
          departmentId: departmentId,
          deletedAt: null
        }
      })

      if (trainers.length === 0) {
        throw new BadRequestException('No trainers found in this department with the provided EIDs')
      }

      if (trainers.length !== trainerEids.length) {
        const foundEids = trainers.map((t) => t.eid)
        const notFoundEids = trainerEids.filter((eid) => !foundEids.includes(eid))
        throw new BadRequestException(`Trainers not found in this department: ${notFoundEids.join(', ')}`)
      }

      // Remove trainers from department (set departmentId to null)
      await this.prisma.user.updateMany({
        where: {
          id: {
            in: trainers.map((t) => t.id)
          }
        },
        data: {
          departmentId: null,
          updatedById
        }
      })

      return {
        message: `Successfully removed ${trainers.length} trainers from department`,
        removedTrainers: trainers.map((t) => ({
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

  private async validateDepartmentHead(headUserId: string) {
    // Check if user exists and has DEPARTMENT_HEAD role
    const user = await this.sharedUserRepo.findUniqueIncludeProfile({ id: headUserId })

    if (!user) {
      throw new Error('User not found')
    }

    if (user.role.name !== 'DEPARTMENT_HEAD') {
      throw new Error('User must have DEPARTMENT_HEAD role to be assigned as department head')
    }

    if (user.role.isActive !== 'ACTIVE') {
      throw new Error('User role must be active')
    }
  }
}

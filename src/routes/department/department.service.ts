import { Injectable } from '@nestjs/common'
import {
  DepartmentAlreadyActiveException,
  DepartmentAlreadyExistsException,
  DepartmentDisableHasActiveEntitiesException,
  DepartmentHeadAlreadyAssignedException,
  DepartmentHeadMustHaveRoleException,
  DepartmentHeadRoleInactiveException,
  DepartmentHeadUserNotFoundException,
  NotFoundDepartmentException,
  NoTrainersFoundInDepartmentException,
  OnlyAdministratorCanEnableDepartmentException,
  TrainersAlreadyInDepartmentException,
  TrainersBelongToOtherDepartmentsException,
  TrainersNotFoundOrInvalidRoleException,
  TrainersNotInDepartmentException
} from '~/routes/department/department.error'
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
    if (data.headUserId) {
      await this.validateDepartmentHead({ headUserId: data.headUserId })
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
    if (data.headUserId) {
      await this.validateDepartmentHead({ headUserId: data.headUserId, departmentId: id })
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
    const department = await this.departmentRepo.findById(id)

    if (!department) {
      throw NotFoundDepartmentException
    }

    const { courseCount, traineeCount, trainerCount } = department

    if (courseCount > 0 || traineeCount > 0 || trainerCount > 0) {
      throw DepartmentDisableHasActiveEntitiesException({
        courseCount,
        traineeCount,
        trainerCount
      })
    }

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
    if (enablerRole !== RoleName.ADMINISTRATOR) {
      throw OnlyAdministratorCanEnableDepartmentException
    }

    try {
      const department = await this.departmentRepo.findById(id, { includeDeleted: true })
      if (!department) {
        throw NotFoundDepartmentException
      }

      if (!department.deletedAt) {
        throw DepartmentAlreadyActiveException
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

  async getDepartmentHeads() {
    const [totalItems, users] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: {
            name: RoleName.DEPARTMENT_HEAD
          },
          deletedAt: null,
          departmentId: null,
          headOfDepartments: {
            none: {
              deletedAt: null
            }
          }
        }
      }),
      this.prisma.user.findMany({
        where: {
          role: {
            name: RoleName.DEPARTMENT_HEAD
          },
          deletedAt: null,
          departmentId: null,
          headOfDepartments: {
            none: {
              deletedAt: null
            }
          }
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
      const department = await this.departmentRepo.findById(departmentId)
      if (!department) {
        throw NotFoundDepartmentException
      }

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
        throw TrainersNotFoundOrInvalidRoleException(notFoundEids)
      }

      const trainersAlreadyInDepartment = trainers.filter((t) => t.departmentId === departmentId)
      if (trainersAlreadyInDepartment.length > 0) {
        const alreadyAssignedEids = trainersAlreadyInDepartment.map((t) => t.eid)
        throw TrainersAlreadyInDepartmentException(alreadyAssignedEids)
      }

      const trainersInOtherDepartments = trainers.filter((t) => t.departmentId && t.departmentId !== departmentId)
      if (trainersInOtherDepartments.length > 0) {
        const assignedToOtherDeptEids = trainersInOtherDepartments.map((t) => t.eid)
        throw TrainersBelongToOtherDepartmentsException(assignedToOtherDeptEids)
      }

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
      const department = await this.departmentRepo.findById(departmentId)
      if (!department) {
        throw NotFoundDepartmentException
      }

      const trainers = await this.prisma.user.findMany({
        where: {
          eid: {
            in: trainerEids
          },
          role: {
            name: RoleName.TRAINER
          },
          departmentId,
          deletedAt: null
        }
      })

      if (trainers.length === 0) {
        throw NoTrainersFoundInDepartmentException
      }

      if (trainers.length !== trainerEids.length) {
        const foundEids = trainers.map((t) => t.eid)
        const notFoundEids = trainerEids.filter((eid) => !foundEids.includes(eid))
        throw TrainersNotInDepartmentException(notFoundEids)
      }

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

  private async validateDepartmentHead({ headUserId, departmentId }: { headUserId: string; departmentId?: string }) {
    const user = await this.sharedUserRepo.findUniqueIncludeProfile({ id: headUserId })

    if (!user) {
      throw DepartmentHeadUserNotFoundException
    }

    if (user.role.name !== RoleName.DEPARTMENT_HEAD) {
      throw DepartmentHeadMustHaveRoleException
    }

    if (user.role.isActive !== 'ACTIVE') {
      throw DepartmentHeadRoleInactiveException
    }

    if (user.department?.id && (!departmentId || user.department.id !== departmentId)) {
      throw DepartmentHeadAlreadyAssignedException
    }

    const existingDepartment = await this.prisma.department.findFirst({
      where: {
        headUserId,
        deletedAt: null,
        ...(departmentId ? { NOT: { id: departmentId } } : {})
      }
    })

    if (existingDepartment) {
      throw DepartmentHeadAlreadyAssignedException
    }
  }
}

import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  DepartmentAlreadyActiveException,
  DepartmentAlreadyExistsException,
  DepartmentHeadBelongsToAnotherDepartmentException,
  DepartmentHeadMustHaveRoleException,
  DepartmentHeadRoleInactiveException,
  DepartmentHeadUserNotFoundException,
  DepartmentHasActiveCoursesException,
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
    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let validatedHead: { id: string; departmentId: string | null } | null = null

      if (data.headUserId) {
        validatedHead = await this.validateDepartmentHead(data.headUserId)
        if (validatedHead.departmentId) {
          throw DepartmentHeadBelongsToAnotherDepartmentException
        }
      }
      try {
        const department = await this.departmentRepo.create(
          {
            createdById,
            data
          },
          tx
        )

        if (validatedHead && validatedHead.departmentId === null) {
          await tx.user.update({
            where: { id: validatedHead.id },
            data: {
              departmentId: department.id,
              updatedById: createdById
            }
          })
        }

        return department
      } catch (error) {
        if (isUniqueConstraintPrismaError(error)) {
          throw DepartmentAlreadyExistsException
        }

        throw error
      }
    })
  }

  async update({ id, data, updatedById }: { id: string; data: UpdateDepartmentBodyType; updatedById: string }) {
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existingDepartment = await tx.department.findUnique({
          where: {
            id,
            deletedAt: null
          },
          select: {
            headUserId: true
          }
        })

        if (!existingDepartment) throw NotFoundDepartmentException

        let validatedHead: { id: string; departmentId: string | null } | null = null

        if (data.headUserId) {
          validatedHead = await this.validateDepartmentHead(data.headUserId, id)
        }

        const department = await this.departmentRepo.update(
          {
            id,
            updatedById,
            data
          },
          tx
        )

        if (validatedHead && validatedHead.departmentId === null) {
          await tx.user.update({
            where: { id: validatedHead.id },
            data: {
              departmentId: null,
              updatedById
            }
          })
        }

        if (validatedHead && validatedHead.departmentId !== id) {
          await tx.user.update({
            where: { id: validatedHead.id },
            data: {
              departmentId: id,
              updatedById
            }
          })
        }

        return department
      })
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
      const [activeCourseCount, activeSubjectCount] = await Promise.all([
        this.prisma.course.count({
          where: {
            departmentId: id,
            deletedAt: null
          }
        }),
        this.prisma.subject.count({
          where: {
            deletedAt: null,
            course: {
              departmentId: id,
              deletedAt: null
            }
          }
        })
      ])

      if (activeCourseCount > 0 || activeSubjectCount > 0) {
        throw DepartmentHasActiveCoursesException
      }

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

  private async validateDepartmentHead(headUserId: string, targetDepartmentId?: string) {
    const user = await this.sharedUserRepo.findUniqueIncludeProfile({ id: headUserId })

    if (!user) throw DepartmentHeadUserNotFoundException
    if (user.role.name !== RoleName.DEPARTMENT_HEAD) throw DepartmentHeadMustHaveRoleException
    if (user.role.isActive === false) throw DepartmentHeadRoleInactiveException
    if (user.department?.id && user.department?.id !== targetDepartmentId) {
      throw DepartmentHeadBelongsToAnotherDepartmentException
    }

    return {
      id: user.id,
      departmentId: user.department?.id ?? null
    }
  }
}

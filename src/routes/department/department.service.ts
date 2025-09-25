import { Injectable } from '@nestjs/common'
import { DepartmentAlreadyExistsException, NotFoundDepartmentException } from '~/routes/department/department.error'
import { CreateDepartmentBodyType, UpdateDepartmentBodyType } from '~/routes/department/department.model'
import { DepartmentRepo } from '~/routes/department/department.repo'
import { RoleName } from '~/shared/constants/auth.constant'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '~/shared/helper'

@Injectable()
export class DepartmentService {
  constructor(private readonly departmentRepo: DepartmentRepo) {}

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
}

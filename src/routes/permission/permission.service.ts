import { Injectable } from '@nestjs/common'
import { NotFoundPermissionException, PermissionAlreadyExistsException } from '~/routes/permission/permission.error'
import {
  CreatePermissionBodyType,
  GetPermissionsQueryType,
  UpdatePermissionBodyType
} from '~/routes/permission/permission.model'
import { PermissionRepo } from '~/routes/permission/permission.repo'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '~/shared/helper'

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepo: PermissionRepo) {}

  async list(pagination: GetPermissionsQueryType) {
    return await this.permissionRepo.list(pagination)
  }

  async findById(id: string) {
    try {
      const permission = await this.permissionRepo.findById(id)
      return permission
    } catch (error) {
      throw NotFoundPermissionException
    }
  }

  async create({ data, createdById }: { data: CreatePermissionBodyType; createdById: string }) {
    try {
      return await this.permissionRepo.create({
        createdById,
        data
      })
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw PermissionAlreadyExistsException
      }
      throw error
    }
  }

  async update({ id, data, updatedById }: { id: string; data: UpdatePermissionBodyType; updatedById: string }) {
    try {
      const permission = await this.permissionRepo.update({
        id,
        updatedById,
        data
      })
      return permission
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundPermissionException
      }
      if (isUniqueConstraintPrismaError(error)) {
        throw PermissionAlreadyExistsException
      }
      throw error
    }
  }

  async delete({ id, deletedById }: { id: string; deletedById: string }) {
    try {
      await this.permissionRepo.delete({
        id,
        deletedById
      })
      return {
        message: 'Delete successfully'
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw NotFoundPermissionException
      }
      throw error
    }
  }
}

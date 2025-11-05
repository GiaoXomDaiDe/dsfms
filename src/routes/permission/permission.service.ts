import { Injectable } from '@nestjs/common'
import {
  createPermissionAlreadyActiveError,
  NotFoundPermissionException,
  PermissionAlreadyExistsException
} from '~/routes/permission/permission.error'
import { PermissionMes } from '~/routes/permission/permission.message'
import { CreatePermissionBodyType, UpdatePermissionBodyType } from '~/routes/permission/permission.model'
import { PermissionRepo } from '~/routes/permission/permission.repo'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '~/shared/helper'

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepo: PermissionRepo) {}

  async list({ excludeModules = [] }: { excludeModules?: string[] } = {}) {
    return await this.permissionRepo.list({
      excludeModules
    })
  }

  async findById(id: string) {
    const permission = await this.permissionRepo.findById(id)
    if (!permission) throw NotFoundPermissionException
    return permission
  }

  async create({ data, createdById }: { data: CreatePermissionBodyType; createdById: string }) {
    try {
      return await this.permissionRepo.create({
        createdById,
        data
      })
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) throw PermissionAlreadyExistsException
      throw error
    }
  }

  async update({ id, data, updatedById }: { id: string; data: UpdatePermissionBodyType; updatedById: string }) {
    try {
      return await this.permissionRepo.update({
        id,
        updatedById,
        data
      })
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundPermissionException
      if (isUniqueConstraintPrismaError(error)) throw PermissionAlreadyExistsException
      throw error
    }
  }

  async delete({ id, deletedById }: { id: string; deletedById: string }) {
    try {
      await this.permissionRepo.delete({
        id,
        deletedById
      })
      return { message: PermissionMes.DELETE_SUCCESS }
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundPermissionException
      throw error
    }
  }

  async enable({ id, enabledById }: { id: string; enabledById: string }) {
    const permission = await this.permissionRepo.findById(id)
    if (!permission) throw NotFoundPermissionException

    if (!permission.deletedAt && permission.isActive) throw createPermissionAlreadyActiveError(permission.name)

    try {
      await this.permissionRepo.enable({ id, enabledById })
      return { message: PermissionMes.ENABLE_SUCCESS }
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundPermissionException
      throw error
    }
  }
}

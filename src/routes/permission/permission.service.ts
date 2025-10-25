import { Injectable } from '@nestjs/common'
import {
  createPermissionAlreadyActiveError,
  NotFoundPermissionException,
  PermissionAlreadyExistsException
} from '~/routes/permission/permission.error'
import { CreatePermissionBodyType, UpdatePermissionBodyType } from '~/routes/permission/permission.model'
import { PermissionRepo } from '~/routes/permission/permission.repo'
import { RoleName } from '~/shared/constants/auth.constant'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '~/shared/helper'

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepo: PermissionRepo) {}

  async list({ includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}) {
    // Chỉ admin mới có thể xem các permission đã bị xóa mềm
    const canViewDeleted = userRole === RoleName.ADMINISTRATOR
    return await this.permissionRepo.list({
      includeDeleted: canViewDeleted ? includeDeleted : false
    })
  }

  async findById(
    id: string,
    { includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}
  ) {
    const canViewDeleted = userRole === RoleName.ADMINISTRATOR
    const permission = await this.permissionRepo.findById(id, {
      includeDeleted: canViewDeleted ? includeDeleted : false
    })
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
      return { message: 'Disable successfully' }
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundPermissionException
      throw error
    }
  }

  async enable({ id, enabledById }: { id: string; enabledById: string }) {
    const permission = await this.permissionRepo.findById(id, { includeDeleted: true })
    if (!permission) throw NotFoundPermissionException

    // Business rule: Check if already active
    if (!permission.deletedAt) throw createPermissionAlreadyActiveError(permission.name)

    try {
      await this.permissionRepo.enable({ id, enabledById })
      return { message: 'Enable permission successfully' }
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundPermissionException
      throw error
    }
  }
}

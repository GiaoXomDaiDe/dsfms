import { Injectable } from '@nestjs/common'
import {
  createRoleAlreadyActiveError,
  NoNewPermissionsToAddException,
  NotFoundRoleException,
  RoleAlreadyExistsException,
  UnexpectedEnableErrorException
} from '~/routes/role/role.error'
import { CreateRoleBodyType, UpdateRoleBodyType } from '~/routes/role/role.model'
import { RoleRepo } from '~/routes/role/role.repo'
import { RoleName } from '~/shared/constants/auth.constant'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '~/shared/helper'
import { SharedPermissionRepository } from '~/shared/repositories/shared-permission.repo'
import { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import { preventAdminDeletion } from '~/shared/validation/entity-operation.validation'

@Injectable()
export class RoleService {
  constructor(
    private readonly roleRepo: RoleRepo,
    private readonly sharedPermissionRepo: SharedPermissionRepository,
    private readonly sharedRoleRepo: SharedRoleRepository
  ) {}

  async list({ includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}) {
    const data = await this.roleRepo.list({
      includeDeleted: userRole === RoleName.ADMINISTRATOR ? includeDeleted : false
    })
    return data
  }

  async findById(
    id: string,
    { includeDeleted = false, userRole }: { includeDeleted?: boolean; userRole?: string } = {}
  ) {
    const role = await this.roleRepo.findById(id, {
      includeDeleted: userRole === RoleName.ADMINISTRATOR ? includeDeleted : false
    })
    if (!role) throw NotFoundRoleException
    return role
  }

  async create({ data, createdById }: { data: CreateRoleBodyType; createdById: string }) {
    if (data.permissionIds && data.permissionIds.length > 0) {
      await this.sharedPermissionRepo.validatePermissionIds(data.permissionIds)
    }

    try {
      return await this.roleRepo.create({ createdById, data })
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) throw RoleAlreadyExistsException
      throw error
    }
  }

  async update({ id, data, updatedById }: { id: string; data: UpdateRoleBodyType; updatedById: string }) {
    if (data.permissionIds && data.permissionIds.length > 0) {
      await this.sharedPermissionRepo.validatePermissionIds(data.permissionIds)
    }

    const role = await this.sharedRoleRepo.findRolebyId(id)
    if (!role) throw NotFoundRoleException

    try {
      return await this.roleRepo.update({ id, updatedById, data })
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundRoleException
      if (isUniqueConstraintPrismaError(error)) throw RoleAlreadyExistsException
      throw error
    }
  }

  async delete({ id, deletedById }: { id: string; deletedById: string }) {
    const role = await this.roleRepo.findById(id)
    if (!role) throw NotFoundRoleException

    preventAdminDeletion(role.name)

    try {
      await this.roleRepo.delete({ id, deletedById })
      return { message: 'Disable successfully' }
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundRoleException
      throw error
    }
  }

  async enable({ id, enabledById }: { id: string; enabledById: string }) {
    const role = await this.roleRepo.findById(id, { includeDeleted: true })
    if (!role) throw NotFoundRoleException

    // Business rule: Check if already active
    if (!role.deletedAt) throw createRoleAlreadyActiveError(role.name)

    try {
      await this.roleRepo.enable({ id, enabledById })
      return { message: 'Enable role successfully' }
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundRoleException
      if (isUniqueConstraintPrismaError(error)) throw UnexpectedEnableErrorException
      throw error
    }
  }

  async addPermissions({
    roleId,
    permissionIds,
    updatedById
  }: {
    roleId: string
    permissionIds: string[]
    updatedById: string
  }) {
    const role = await this.roleRepo.findById(roleId)
    if (!role) throw NotFoundRoleException

    await this.sharedPermissionRepo.validatePermissionIds(permissionIds)

    try {
      const result = await this.roleRepo.addPermissions({
        roleId,
        permissionIds,
        updatedById
      })

      if (result.addedPermissions.length === 0) {
        throw NoNewPermissionsToAddException
      }

      return {
        message: `Successfully added ${result.addedPermissions.length} permission(s) to role "${role.name}"`,
        addedPermissions: result.addedPermissions
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundRoleException
      throw error
    }
  }
}

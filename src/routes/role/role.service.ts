import { Injectable } from '@nestjs/common'
import {
  createRoleAlreadyActiveError,
  NoNewPermissionsToAddException,
  NoPermissionsToRemoveException,
  NotFoundRoleException,
  RoleAlreadyExistsException,
  UnexpectedEnableErrorException
} from '~/routes/role/role.error'
import { RoleMes } from '~/routes/role/role.message'
import {
  AddPermissionsToRoleResType,
  CreateRoleBodyType,
  CreateRoleResType,
  GetRoleDetailResType,
  GetRolesResType,
  RemovePermissionsFromRoleResType,
  RoleWithPermissionsType,
  UpdateRoleBodyType
} from '~/routes/role/role.model'
import { RoleRepo } from '~/routes/role/role.repo'
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

  async list(): Promise<GetRolesResType> {
    const data = await this.roleRepo.list()
    return data
  }

  async findById(id: string): Promise<GetRoleDetailResType> {
    const role = await this.roleRepo.findById(id)
    if (!role) throw NotFoundRoleException
    return role
  }

  async create({ data, createdById }: { data: CreateRoleBodyType; createdById: string }): Promise<CreateRoleResType> {
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

  async update({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateRoleBodyType
    updatedById: string
  }): Promise<RoleWithPermissionsType> {
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

  async delete({ id, deletedById }: { id: string; deletedById: string }): Promise<{ message: string }> {
    const role = await this.roleRepo.findById(id)
    if (!role) throw NotFoundRoleException

    preventAdminDeletion(role.name)

    try {
      await this.roleRepo.delete({ id, deletedById })
      return { message: RoleMes.DELETE_SUCCESS }
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundRoleException
      throw error
    }
  }

  async enable({ id, enabledById }: { id: string; enabledById: string }): Promise<{ message: string }> {
    const role = await this.roleRepo.findById(id)
    if (!role) throw NotFoundRoleException

    if (!role.deletedAt && role.isActive) throw createRoleAlreadyActiveError(role.name)

    try {
      await this.roleRepo.enable({ id, enabledById })
      return { message: RoleMes.ENABLE_SUCCESS }
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
  }): Promise<AddPermissionsToRoleResType> {
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
        addedPermissions: result.addedPermissions,
        addedCount: result.addedPermissions.length,
        summary: `Successfully added ${result.addedPermissions.length} permission(s) to role '${role.name}'`
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundRoleException
      throw error
    }
  }

  async removePermissions({
    roleId,
    permissionIds,
    updatedById
  }: {
    roleId: string
    permissionIds: string[]
    updatedById: string
  }): Promise<RemovePermissionsFromRoleResType> {
    const role = await this.roleRepo.findById(roleId)
    if (!role) throw NotFoundRoleException

    await this.sharedPermissionRepo.validatePermissionIds(permissionIds)

    try {
      const result = await this.roleRepo.removePermissions({
        roleId,
        permissionIds,
        updatedById
      })

      if (result.removedPermissions.length === 0) {
        throw NoPermissionsToRemoveException
      }

      return {
        removedPermissions: result.removedPermissions,
        removedCount: result.removedPermissions.length,
        summary: `Successfully removed ${result.removedPermissions.length} permission(s) from role '${role.name}'`
      }
    } catch (error) {
      if (isNotFoundPrismaError(error)) throw NotFoundRoleException
      throw error
    }
  }
}

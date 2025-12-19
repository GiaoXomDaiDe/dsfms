import { Injectable, Logger } from '@nestjs/common'
import {
  createPermissionGroupNotFoundError,
  createPermissionGroupWithoutPermissionsError,
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
import { getDefaultPermissionNamesForRole } from '~/shared/constants/role-default-permissions/role-default-permissions.constant'
import { isNotFoundPrismaError, isUniqueConstraintPrismaError } from '~/shared/helper'
import { SharedPermissionGroupRepository } from '~/shared/repositories/shared-permission-group.repo'
import { SharedPermissionRepository } from '~/shared/repositories/shared-permission.repo'
import { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import { mapPermissionGroups } from '~/shared/utils/permission-group.util'
import { preventAdminDeletion } from '~/shared/validation/entity-operation.validation'

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name)

  constructor(
    private readonly roleRepo: RoleRepo,
    private readonly sharedPermissionRepo: SharedPermissionRepository,
    private readonly sharedRoleRepo: SharedRoleRepository,
    private readonly sharedPermissionGroupRepo: SharedPermissionGroupRepository
  ) {}

  async list(): Promise<GetRolesResType> {
    const data = await this.roleRepo.list()
    return data
  }

  async findById(id: string): Promise<GetRoleDetailResType> {
    const role = await this.roleRepo.findById(id)
    if (!role) throw NotFoundRoleException

    // Lấy:
    // - Danh sách endpoint active mà role này đang có quyền
    // - Tất cả permission group cùng với các endpoint active gắn vào group đó
    const [roleEndpointIds, allGroups] = await Promise.all([
      this.sharedPermissionGroupRepo.findRoleActiveEndpointIds(role.id),
      this.sharedPermissionGroupRepo.findAllGroupsWithActiveEndpointMappings()
    ])

    const roleEndpointSet = new Set(roleEndpointIds)

    // Chỉ giữ lại những group mà:
    // - Có ít nhất 1 endpoint
    // - TẤT CẢ endpoint trong group đều thuộc tập endpoint của role
    const fullyGrantedGroups = allGroups.filter((group) => {
      const groupEndpointIds = group.permissions.map((permission) => permission.endpointPermissionId)
      if (groupEndpointIds.length === 0) return false
      return groupEndpointIds.every((endpointId) => roleEndpointSet.has(endpointId))
    })

    const grouped = mapPermissionGroups(
      fullyGrantedGroups.map((group) => ({
        groupName: group.groupName,
        permissionGroupCode: group.permissionGroupCode,
        name: group.name
      }))
    )

    const permissionCount = grouped.reduce((total, group) => total + group.permissions.length, 0)

    return {
      ...role,
      permissionCount,
      permissionGroups: grouped
    }
  }

  async create({ data, createdById }: { data: CreateRoleBodyType; createdById: string }): Promise<CreateRoleResType> {
    const [permissionIds, defaultPermissionIds] = await Promise.all([
      this.resolvePermissionIdsFromGroupCodes(data.permissionGroupCodes),
      this.sharedPermissionRepo.findActiveIdsByNames(getDefaultPermissionNamesForRole(data.name))
    ])

    const mergedPermissionIds = Array.from(new Set([...permissionIds, ...defaultPermissionIds]))

    try {
      return await this.roleRepo.create({ createdById, data, permissionIds: mergedPermissionIds })
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
    this.logger.debug(`Update role request received | roleId=${id} | updatedById=${updatedById}`)
    const existingRole = await this.sharedRoleRepo.findById(id)
    if (!existingRole) throw NotFoundRoleException

    this.logger.debug(`Existing role found | name=${existingRole.name} | isActive=${existingRole.isActive}`)
    this.logger.debug(
      `Incoming payload | permissionGroupCodes=${data.permissionGroupCodes?.join(', ') ?? 'none'} | dataKeys=${Object.keys(data).join(',')}`
    )

    let permissionIds: string[] | undefined

    if (data.permissionGroupCodes && data.permissionGroupCodes.length > 0) {
      this.logger.debug(`Resolving permission IDs from group codes | count=${data.permissionGroupCodes.length}`)
      const [groupPermissionIds, defaultPermissionIds] = await Promise.all([
        this.resolvePermissionIdsFromGroupCodes(data.permissionGroupCodes),
        this.sharedPermissionRepo.findActiveIdsByNames(getDefaultPermissionNamesForRole(existingRole.name))
      ])

      this.logger.debug(
        `Resolved IDs | fromGroups=${groupPermissionIds.length} | defaultForRole(${existingRole.name})=${defaultPermissionIds.length}`
      )

      permissionIds = Array.from(new Set([...groupPermissionIds, ...defaultPermissionIds]))

      this.logger.debug(
        `Updating role '${existingRole.name}' - replacing permissions using group codes: ${data.permissionGroupCodes.join(', ')}`
      )
      this.logger.debug(
        `New permission IDs count (groups + default): ${groupPermissionIds.length} + ${defaultPermissionIds.length} => ${permissionIds.length}`
      )
    } else {
      this.logger.debug(
        `Updating role '${existingRole.name}' without permissionGroupCodes - existing permissions will be preserved`
      )
    }

    try {
      this.logger.debug(
        `Persisting role update | roleId=${id} | permissionIds=${permissionIds ? permissionIds.length : 'preserve existing'}`
      )
      return await this.roleRepo.update({ id, updatedById, data, permissionIds })
    } catch (error) {
      this.logger.error(
        `Failed to update role | roleId=${id} | error=${error instanceof Error ? error.message : error}`
      )
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

  /* =========================================================================
   * ADD / REMOVE PERMISSIONS
   * ========================================================================= */

  async addPermissions({
    roleId,
    permissionIds,
    updatedById
  }: {
    roleId: string
    permissionIds: string[]
    updatedById: string
  }): Promise<AddPermissionsToRoleResType> {
    this.logger.debug(
      `Add permissions request | roleId=${roleId} | updatedById=${updatedById} | permissionIds=${permissionIds.join(', ')}`
    )
    const role = await this.roleRepo.findById(roleId)
    if (!role) throw NotFoundRoleException

    await this.sharedPermissionRepo.validatePermissionIds(permissionIds)
    this.logger.debug(`Validated permission IDs for add | count=${permissionIds.length}`)

    try {
      const result = await this.roleRepo.addPermissions({
        roleId,
        permissionIds,
        updatedById
      })

      this.logger.debug(`Add permissions result | addedCount=${result.addedPermissions.length} | roleName=${role.name}`)

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
    this.logger.debug(
      `Remove permissions request | roleId=${roleId} | updatedById=${updatedById} | permissionIds=${permissionIds.join(', ')}`
    )
    const role = await this.roleRepo.findById(roleId)
    if (!role) throw NotFoundRoleException

    await this.sharedPermissionRepo.validatePermissionIds(permissionIds)
    this.logger.debug(`Validated permission IDs for remove | count=${permissionIds.length}`)

    try {
      const result = await this.roleRepo.removePermissions({
        roleId,
        permissionIds,
        updatedById
      })

      this.logger.debug(
        `Remove permissions result | removedCount=${result.removedPermissions.length} | roleName=${role.name}`
      )

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

  private async resolvePermissionIdsFromGroupCodes(permissionGroupCodes: string[]): Promise<string[]> {
    this.logger.debug(`Resolve permissions from group codes | codes=${permissionGroupCodes.join(', ')}`)
    const permissionGroups =
      await this.sharedPermissionGroupRepo.findActivePermissionMappingsByCodes(permissionGroupCodes)

    const foundCodes = new Set(permissionGroups.map((group) => group.permissionGroupCode))
    const missingCodes = permissionGroupCodes.filter((code) => !foundCodes.has(code))

    if (missingCodes.length > 0) {
      this.logger.warn(`Permission group codes not found | missing=${missingCodes.join(', ')}`)
      throw createPermissionGroupNotFoundError(missingCodes)
    }

    const groupsWithoutPermissions = permissionGroups.filter((group) => group.permissions.length === 0)
    if (groupsWithoutPermissions.length > 0) {
      this.logger.warn(
        `Permission groups without permissions | codes=${groupsWithoutPermissions
          .map((group) => group.permissionGroupCode)
          .join(', ')}`
      )
      throw createPermissionGroupWithoutPermissionsError(
        groupsWithoutPermissions.map((group) => group.permissionGroupCode)
      )
    }

    const permissionIds = permissionGroups.flatMap((group) =>
      group.permissions.map((permission) => permission.endpointPermissionId)
    )

    this.logger.debug(
      `Resolved permission IDs from groups | uniqueCount=${new Set(permissionIds).size} | rawCount=${permissionIds.length}`
    )

    return Array.from(new Set(permissionIds))
  }
}

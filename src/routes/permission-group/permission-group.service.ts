import { Injectable, NotFoundException } from '@nestjs/common'
import { HttpMethod } from '@prisma/client'
import { SharedPermissionRepository } from '~/shared/repositories/shared-permission.repo'
import { mapPermissionGroups } from '~/shared/utils/permission-group.util'
import {
  AssignPermissionGroupPermissionsBodyType,
  CreatePermissionGroupBodyType,
  PermissionGroupCollectionType,
  PermissionGroupDetailType,
  PermissionGroupPermissionType,
  PermissionGroupType,
  UpdatePermissionGroupBodyType
} from './permission-group.model'
import { PermissionGroupRepo } from './permission-group.repo'

type PermissionGroupWithEndpoints = PermissionGroupType & {
  permissions: Array<{
    endpointPermission: {
      id: string
      name: string
      method: HttpMethod
      path: string
      module: string
      description: string | null
      viewModule: string | null
      viewName: string | null
    } | null
  }>
}

@Injectable()
export class PermissionGroupService {
  constructor(
    private readonly permissionGroupRepo: PermissionGroupRepo,
    private readonly sharedPermissionRepo: SharedPermissionRepository
  ) {}

  create(data: CreatePermissionGroupBodyType) {
    return this.permissionGroupRepo.create(data)
  }

  async list(): Promise<PermissionGroupCollectionType[]> {
    const permissionGroups = await this.permissionGroupRepo.list()
    return mapPermissionGroups(permissionGroups)
  }

  async findOne(id: string): Promise<PermissionGroupDetailType> {
    return this.getDetailedGroup(id)
  }

  async update(id: string, data: UpdatePermissionGroupBodyType): Promise<void> {
    await this.ensureExists(id)
    await this.permissionGroupRepo.update(id, data)
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id)
    await this.permissionGroupRepo.delete(id)
  }

  async assignPermissions(
    permissionGroupId: string,
    dto: AssignPermissionGroupPermissionsBodyType
  ): Promise<PermissionGroupDetailType> {
    await this.ensureExists(permissionGroupId)

    const permissionIds = Array.from(new Set(dto.permissionIds ?? []))

    if (permissionIds.length > 0) {
      await this.sharedPermissionRepo.validatePermissionIds(permissionIds)
    }

    await this.permissionGroupRepo.replaceEndpointPermissions(permissionGroupId, permissionIds)

    return this.getDetailedGroup(permissionGroupId)
  }

  private buildNotFoundError(id: string) {
    return new NotFoundException(`PermissionGroup ${id} not found`)
  }

  private async ensureExists(id: string): Promise<PermissionGroupType> {
    const group = await this.permissionGroupRepo.findById(id)
    if (!group) {
      throw this.buildNotFoundError(id)
    }
    return group
  }

  private async getDetailedGroup(id: string): Promise<PermissionGroupDetailType> {
    const group = await this.permissionGroupRepo.findDetailById(id)
    if (!group) {
      throw this.buildNotFoundError(id)
    }

    return this.mapGroupDetail(group as PermissionGroupWithEndpoints)
  }

  private mapGroupDetail(group: PermissionGroupWithEndpoints): PermissionGroupDetailType {
    const permissions: PermissionGroupPermissionType[] = group.permissions
      .map((link) => link.endpointPermission)
      .filter((permission): permission is NonNullable<typeof permission> => Boolean(permission))
      .map((permission) => ({
        id: permission.id,
        name: permission.name,
        method: permission.method,
        path: permission.path,
        module: permission.module,
        description: permission.description ?? null,
        viewModule: permission.viewModule ?? null,
        viewName: permission.viewName ?? null
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      id: group.id,
      groupName: group.groupName,
      name: group.name,
      permissionGroupCode: group.permissionGroupCode,
      permissionCount: permissions.length,
      permissions
    }
  }
}

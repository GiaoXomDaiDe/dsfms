import { Injectable, NotFoundException } from '@nestjs/common'
import { groupBy } from 'lodash'
import { SharedPermissionRepository } from '~/shared/repositories/shared-permission.repo'
import {
  AssignPermissionGroupPermissionsBodyType,
  CreatePermissionGroupBodyType,
  PermissionGroupCollectionType,
  UpdatePermissionGroupBodyType
} from './permission-group.model'
import { PermissionGroupRepo } from './permission-group.repo'

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
    const grouped = groupBy(permissionGroups, 'groupName')

    return Object.entries(grouped).map(([groupName, permissions]) => ({
      groupName,
      permissionsGroup: permissions.map((permission) => ({
        id: permission.id,
        code: permission.permissionGroupCode,
        name: permission.name
      }))
    }))
  }

  async findOne(id: string) {
    return this.ensureExists(id)
  }

  async update(id: string, data: UpdatePermissionGroupBodyType) {
    await this.ensureExists(id)
    await this.permissionGroupRepo.update(id, data)
  }

  async remove(id: string) {
    await this.ensureExists(id)
    await this.permissionGroupRepo.delete(id)
  }

  async assignPermissions(permissionGroupId: string, dto: AssignPermissionGroupPermissionsBodyType) {
    await this.ensureExists(permissionGroupId)

    const permissionIds = Array.from(new Set(dto.permissionIds ?? []))

    if (permissionIds.length > 0) {
      await this.sharedPermissionRepo.validatePermissionIds(permissionIds)
    }

    await this.permissionGroupRepo.replaceEndpointPermissions(permissionGroupId, permissionIds)

    return this.ensureExists(permissionGroupId)
  }

  private async ensureExists(id: string) {
    const group = await this.permissionGroupRepo.findById(id)
    if (!group) {
      throw new NotFoundException(`PermissionGroup ${id} not found`)
    }
    return group
  }
}

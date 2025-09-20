import { Injectable } from '@nestjs/common'
import { GetPermissionsQueryType } from '~/routes/permission/permission.model'
import { PermissionRepo } from '~/routes/permission/permission.repo'

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepo: PermissionRepo) {}

  async list(pagination: GetPermissionsQueryType) {
    return await this.permissionRepo.list(pagination)
  }

  async findById(id: string) {
    return await this.permissionRepo.findById(id)
  }
}

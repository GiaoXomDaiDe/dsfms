import { Module } from '@nestjs/common'
import { RoleRepo } from '~/routes/role/role.repo'
import { SharedPermissionGroupRepository } from '~/shared/repositories/shared-permission-group.repo'
import { RoleController } from './role.controller'
import { RoleService } from './role.service'

@Module({
  controllers: [RoleController],
  providers: [RoleService, RoleRepo, SharedPermissionGroupRepository],
  exports: [RoleService]
})
export class RoleModule {}

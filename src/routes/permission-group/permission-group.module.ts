import { Module } from '@nestjs/common'
import { PermissionGroupController } from './permission-group.controller'
import { PermissionGroupRepo } from './permission-group.repo'
import { PermissionGroupService } from './permission-group.service'

@Module({
  controllers: [PermissionGroupController],
  providers: [PermissionGroupService, PermissionGroupRepo],
  exports: [PermissionGroupService]
})
export class PermissionGroupModule {}

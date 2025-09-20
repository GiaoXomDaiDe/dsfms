import { Module } from '@nestjs/common'
import { PermissionRepo } from '~/routes/permission/permission.repo'
import { PermissionController } from './permission.controller'
import { PermissionService } from './permission.service'

@Module({
  controllers: [PermissionController],
  providers: [PermissionService, PermissionRepo]
})
export class PermissionModule {}

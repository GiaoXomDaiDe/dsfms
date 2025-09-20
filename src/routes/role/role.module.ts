import { Module } from '@nestjs/common'
import { RoleRepo } from '~/routes/role/role.repo'
import { RoleController } from './role.controller'
import { RoleService } from './role.service'

@Module({
  controllers: [RoleController],
  providers: [RoleService, RoleRepo],
  exports: [RoleService]
})
export class RoleModule {}

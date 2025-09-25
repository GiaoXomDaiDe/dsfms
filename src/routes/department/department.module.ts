import { Module } from '@nestjs/common'
import { DepartmentController } from '~/routes/department/department.controller'
import { DepartmentRepo } from '~/routes/department/department.repo'
import { DepartmentService } from '~/routes/department/department.service'

@Module({
  controllers: [DepartmentController],
  providers: [DepartmentService, DepartmentRepo],
  exports: [DepartmentService, DepartmentRepo]
})
export class DepartmentModule {}

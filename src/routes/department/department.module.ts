import { Module } from '@nestjs/common'
import { DepartmentController } from '~/routes/department/department.controller'
import { DepartmentRepository } from '~/routes/department/department.repo'
import { DepartmentService } from '~/routes/department/department.service'

@Module({
  controllers: [DepartmentController],
  providers: [DepartmentService, DepartmentRepository],
  exports: [DepartmentService, DepartmentRepository]
})
export class DepartmentModule {}

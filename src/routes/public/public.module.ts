import { Module } from '@nestjs/common'
import { PublicCourseController } from './course/public-course.controller'
import { PublicCourseService } from './course/public-course.service'
import { PublicDepartmentController } from './department/public-department.controller'
import { PublicDepartmentService } from './department/public-department.service'
import { PublicRoleController } from './role/public-role.controller'
import { PublicRoleService } from './role/public-role.service'

@Module({
  controllers: [PublicDepartmentController, PublicRoleController, PublicCourseController],
  providers: [PublicDepartmentService, PublicRoleService, PublicCourseService],
  exports: [PublicDepartmentService, PublicRoleService, PublicCourseService]
})
export class PublicModule {}

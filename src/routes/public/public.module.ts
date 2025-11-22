import { Module } from '@nestjs/common'
import { PublicCourseController } from './course/public-course.controller'
import { PublicCourseService } from './course/public-course.service'
import { PublicDepartmentController } from './department/public-department.controller'
import { PublicDepartmentService } from './department/public-department.service'
import { PublicRoleController } from './role/public-role.controller'
import { PublicRoleService } from './role/public-role.service'
import { PublicTraineeController } from './trainee/public-trainee.controller'
import { PublicTraineeService } from './trainee/public-trainee.service'

@Module({
  controllers: [PublicDepartmentController, PublicRoleController, PublicCourseController, PublicTraineeController],
  providers: [PublicDepartmentService, PublicRoleService, PublicCourseService, PublicTraineeService],
  exports: [PublicDepartmentService, PublicRoleService, PublicCourseService, PublicTraineeService]
})
export class PublicModule {}

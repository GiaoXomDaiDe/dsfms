import { createZodDto } from 'nestjs-zod'
import {
  AssignCourseTrainerBodySchema,
  AssignCourseTrainerResSchema,
  CourseTrainerParamsSchema,
  CreateCourseBodySchema,
  CreateCourseResSchema,
  GetCourseParamsSchema,
  GetCourseResSchema,
  GetCoursesResSchema,
  GetCourseTraineeEnrollmentsQuerySchema,
  GetCourseTraineeEnrollmentsResSchema,
  GetCourseTraineesQuerySchema,
  GetCourseTraineesResSchema,
  UpdateCourseBodySchema,
  UpdateCourseResSchema,
  UpdateCourseTrainerRoleBodySchema,
  UpdateCourseTrainerRoleResSchema
} from '~/routes/course/course.model'

export class GetCourseParamsDto extends createZodDto(GetCourseParamsSchema) {}
export class GetCoursesResDto extends createZodDto(GetCoursesResSchema) {}
export class GetCourseResDto extends createZodDto(GetCourseResSchema) {}
export class CreateCourseBodyDto extends createZodDto(CreateCourseBodySchema) {}
export class CreateCourseResDto extends createZodDto(CreateCourseResSchema) {}
export class UpdateCourseBodyDto extends createZodDto(UpdateCourseBodySchema) {}
export class UpdateCourseResDto extends createZodDto(UpdateCourseResSchema) {}
export class GetCourseTraineesQueryDto extends createZodDto(GetCourseTraineesQuerySchema) {}
export class GetCourseTraineesResDto extends createZodDto(GetCourseTraineesResSchema) {}
export class GetCourseTraineeEnrollmentsQueryDto extends createZodDto(GetCourseTraineeEnrollmentsQuerySchema) {}
export class GetCourseTraineeEnrollmentsResDto extends createZodDto(GetCourseTraineeEnrollmentsResSchema) {}
export class CourseTrainerParamsDto extends createZodDto(CourseTrainerParamsSchema) {}
export class AssignCourseTrainerBodyDto extends createZodDto(AssignCourseTrainerBodySchema) {}
export class AssignCourseTrainerResDto extends createZodDto(AssignCourseTrainerResSchema) {}
export class UpdateCourseTrainerRoleBodyDto extends createZodDto(UpdateCourseTrainerRoleBodySchema) {}
export class UpdateCourseTrainerRoleResDto extends createZodDto(UpdateCourseTrainerRoleResSchema) {}

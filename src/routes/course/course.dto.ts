import { createZodDto } from 'nestjs-zod'
import {
  AssignCourseTrainerBodySchema,
  AssignCourseTrainerResSchema,
  CancelCourseEnrollmentsBodySchema,
  CourseTrainerParamsSchema,
  CreateCourseBodySchema,
  CreateCourseResSchema,
  GetCourseParamsSchema,
  GetCourseResSchema,
  GetCoursesResSchema,
  GetCourseTraineesQuerySchema,
  GetCourseTraineesResSchema,
  UpdateCourseBodySchema,
  UpdateCourseResSchema,
  UpdateCourseTrainerAssignmentBodySchema,
  UpdateCourseTrainerAssignmentResSchema
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
export class CancelCourseEnrollmentsBodyDto extends createZodDto(CancelCourseEnrollmentsBodySchema) {}
export class CourseTrainerParamsDto extends createZodDto(CourseTrainerParamsSchema) {}
export class AssignCourseTrainerBodyDto extends createZodDto(AssignCourseTrainerBodySchema) {}
export class AssignCourseTrainerResDto extends createZodDto(AssignCourseTrainerResSchema) {}
export class UpdateCourseTrainerAssignmentBodyDto extends createZodDto(UpdateCourseTrainerAssignmentBodySchema) {}
export class UpdateCourseTrainerAssignmentResDto extends createZodDto(UpdateCourseTrainerAssignmentResSchema) {}

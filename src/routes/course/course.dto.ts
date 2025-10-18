import { createZodDto } from 'nestjs-zod'
import {
  CancelCourseEnrollmentsBodySchema,
  CreateCourseBodySchema,
  CreateCourseResSchema,
  GetCourseParamsSchema,
  GetCourseResSchema,
  GetCoursesQuerySchema,
  GetCoursesResSchema,
  GetCourseTraineesQuerySchema,
  GetCourseTraineesResSchema,
  GetTraineeEnrollmentsResSchema,
  UpdateCourseBodySchema,
  UpdateCourseResSchema
} from '~/routes/course/course.model'

export class GetCoursesQueryDto extends createZodDto(GetCoursesQuerySchema) {}
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
export class GetTraineeEnrollmentsResDto extends createZodDto(GetTraineeEnrollmentsResSchema) {}

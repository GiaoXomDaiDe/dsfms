import { createZodDto } from 'nestjs-zod'
import {
  AddSubjectToCourseBodySchema,
  AddSubjectToCourseResSchema,
  CourseDetailResSchema,
  CourseStatsSchema,
  CreateCourseBodySchema,
  GetCourseParamsSchema,
  GetCoursesQuerySchema,
  GetCoursesResSchema,
  RemoveSubjectFromCourseBodySchema,
  RemoveSubjectFromCourseResSchema,
  UpdateCourseBodySchema
} from '~/routes/course/course.model'

export class GetCoursesQueryDto extends createZodDto(GetCoursesQuerySchema) {}
export class GetCoursesResDto extends createZodDto(GetCoursesResSchema) {}
export class GetCourseParamsDto extends createZodDto(GetCourseParamsSchema) {}
export class CreateCourseBodyDto extends createZodDto(CreateCourseBodySchema) {}
export class UpdateCourseBodyDto extends createZodDto(UpdateCourseBodySchema) {}
export class CourseDetailResDto extends createZodDto(CourseDetailResSchema) {}
export class CourseStatsDto extends createZodDto(CourseStatsSchema) {}
export class AddSubjectToCourseBodyDto extends createZodDto(AddSubjectToCourseBodySchema) {}
export class AddSubjectToCourseResDto extends createZodDto(AddSubjectToCourseResSchema) {}
export class RemoveSubjectFromCourseBodyDto extends createZodDto(RemoveSubjectFromCourseBodySchema) {}
export class RemoveSubjectFromCourseResDto extends createZodDto(RemoveSubjectFromCourseResSchema) {}

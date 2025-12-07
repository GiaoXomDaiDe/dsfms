import { createZodDto } from 'nestjs-zod'
import { CourseMes } from '~/routes/course/course.message'
import {
  AssignCourseTrainerBodySchema,
  AssignCourseTrainerResSchema,
  CourseTrainerParamsSchema,
  CreateCourseBodySchema,
  CreateCourseResSchema,
  GetCourseEnrollmentBatchesResSchema,
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
import { createResponseDto } from '~/shared/helper'

export class GetCourseParamsDto extends createZodDto(GetCourseParamsSchema) {}
export class GetCoursesResDto extends createResponseDto(GetCoursesResSchema, CourseMes.LIST_SUCCESS) {}
export class GetCourseResDto extends createResponseDto(GetCourseResSchema, CourseMes.DETAIL_SUCCESS) {}
export class CreateCourseBodyDto extends createZodDto(CreateCourseBodySchema) {}
export class CreateCourseResDto extends createResponseDto(CreateCourseResSchema, CourseMes.CREATE_SUCCESS) {}
export class UpdateCourseBodyDto extends createZodDto(UpdateCourseBodySchema) {}
export class UpdateCourseResDto extends createResponseDto(UpdateCourseResSchema, CourseMes.UPDATE_SUCCESS) {}
export class GetCourseTraineesQueryDto extends createZodDto(GetCourseTraineesQuerySchema) {}
export class GetCourseTraineesResDto extends createResponseDto(
  GetCourseTraineesResSchema,
  CourseMes.TRAINEES_SUCCESS
) {}
export class GetCourseTraineeEnrollmentsQueryDto extends createZodDto(GetCourseTraineeEnrollmentsQuerySchema) {}
export class GetCourseTraineeEnrollmentsResDto extends createResponseDto(
  GetCourseTraineeEnrollmentsResSchema,
  CourseMes.TRAINEE_ENROLLMENTS_SUCCESS
) {}
export class CourseTrainerParamsDto extends createZodDto(CourseTrainerParamsSchema) {}
export class AssignCourseTrainerBodyDto extends createZodDto(AssignCourseTrainerBodySchema) {}
export class AssignCourseTrainerResDto extends createResponseDto(
  AssignCourseTrainerResSchema,
  CourseMes.ASSIGN_TRAINER_SUCCESS
) {}
export class UpdateCourseTrainerRoleBodyDto extends createZodDto(UpdateCourseTrainerRoleBodySchema) {}
export class UpdateCourseTrainerRoleResDto extends createResponseDto(
  UpdateCourseTrainerRoleResSchema,
  CourseMes.UPDATE_TRAINER_ROLE_SUCCESS
) {}
export class GetCourseEnrollmentBatchesResDto extends createZodDto(GetCourseEnrollmentBatchesResSchema) {}

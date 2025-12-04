import { createZodDto } from 'nestjs-zod'
import { SubjectMes } from '~/routes/subject/subject.message'
import {
  AssignTraineesBodySchema,
  AssignTraineesResSchema,
  AssignTrainerBodySchema,
  AssignTrainerResSchema,
  BulkCreateSubjectsBodySchema,
  BulkCreateSubjectsResSchema,
  CancelSubjectEnrollmentBodySchema,
  CourseBatchParamsSchema,
  CreateSubjectBodySchema,
  GetActiveTraineesResSchema,
  GetAvailableTrainersResSchema,
  GetEnrollmentsQuerySchema,
  GetEnrollmentsResSchema,
  GetSubjectDetailResSchema,
  GetSubjectEnrollmentsQuerySchema,
  GetSubjectEnrollmentsResSchema,
  GetSubjectsQuerySchema,
  GetSubjectsResSchema,
  GetTraineeCourseSubjectsResSchema,
  GetTraineeEnrollmentsQuerySchema,
  GetTraineeEnrollmentsResSchema,
  LookupTraineesBodySchema,
  RemoveCourseEnrollmentsByBatchResSchema,
  RemoveCourseTraineeEnrollmentsBodySchema,
  RemoveCourseTraineeEnrollmentsResSchema,
  RemoveEnrollmentsBodySchema,
  RemoveEnrollmentsResSchema,
  SubjectTraineeParamsSchema,
  SubjectTrainerParamsSchema,
  TraineeIdParamsSchema,
  UpdateSubjectBodySchema,
  UpdateTrainerAssignmentBodySchema,
  UpdateTrainerAssignmentResSchema
} from '~/routes/subject/subject.model'
import { createResponseDto } from '~/shared/helper'
import { SubjectIdParamsSchema, SubjectSchema } from '~/shared/models/shared-subject.model'
import { UserLookupResSchema } from '~/shared/models/shared-user.model'

export class GetSubjectsQueryDto extends createZodDto(GetSubjectsQuerySchema) {}
export class GetSubjectsResDto extends createResponseDto(GetSubjectsResSchema, SubjectMes.LIST_SUCCESS) {}
export class GetSubjectDetailResDto extends createResponseDto(GetSubjectDetailResSchema, SubjectMes.DETAIL_SUCCESS) {}
export class UpdateSubjectResDto extends createResponseDto(GetSubjectDetailResSchema, SubjectMes.UPDATE_SUCCESS) {}
export class GetAvailableTrainersResDto extends createResponseDto(
  GetAvailableTrainersResSchema,
  SubjectMes.ACTIVE_TRAINERS_SUCCESS
) {}
export class GetActiveTraineesResDto extends createResponseDto(
  GetActiveTraineesResSchema,
  SubjectMes.ACTIVE_TRAINEES_SUCCESS
) {}
export class SubjectIdParamsDto extends createZodDto(SubjectIdParamsSchema) {}
export class SubjectTrainerParamsDto extends createZodDto(SubjectTrainerParamsSchema) {}
export class SubjectTraineeParamsDto extends createZodDto(SubjectTraineeParamsSchema) {}
export class TraineeIdParamsDto extends createZodDto(TraineeIdParamsSchema) {}
export class CreateSubjectBodyDto extends createZodDto(CreateSubjectBodySchema) {}
export class CreateSubjectResDto extends createResponseDto(SubjectSchema, SubjectMes.CREATE_SUCCESS) {}
export class BulkCreateSubjectsBodyDto extends createZodDto(BulkCreateSubjectsBodySchema) {}
export class UpdateSubjectBodyDto extends createZodDto(UpdateSubjectBodySchema) {}
export class AssignTrainerBodyDto extends createZodDto(AssignTrainerBodySchema) {}
export class AssignTrainerResDto extends createResponseDto(AssignTrainerResSchema, SubjectMes.ASSIGN_TRAINER_SUCCESS) {}
export class UpdateTrainerAssignmentBodyDto extends createZodDto(UpdateTrainerAssignmentBodySchema) {}
export class UpdateTrainerAssignmentResDto extends createResponseDto(
  UpdateTrainerAssignmentResSchema,
  SubjectMes.UPDATE_TRAINER_ASSIGNMENT_SUCCESS
) {}
export class LookupTraineesResDto extends createResponseDto(UserLookupResSchema, SubjectMes.LOOKUP_TRAINEES_SUCCESS) {}
export class LookupTraineesBodyDto extends createZodDto(LookupTraineesBodySchema) {}
export class AssignTraineesBodyDto extends createZodDto(AssignTraineesBodySchema) {}
export class AssignTraineesResDto extends createResponseDto(
  AssignTraineesResSchema,
  SubjectMes.ASSIGN_TRAINEES_SUCCESS
) {}
export class CancelSubjectEnrollmentBodyDto extends createZodDto(CancelSubjectEnrollmentBodySchema) {}
export class GetEnrollmentsQueryDto extends createZodDto(GetEnrollmentsQuerySchema) {}
export class GetEnrollmentsResDto extends createZodDto(GetEnrollmentsResSchema) {}

export class GetTraineeEnrollmentsQueryDto extends createZodDto(GetTraineeEnrollmentsQuerySchema) {}
export class GetTraineeEnrollmentsResDto extends createResponseDto(
  GetTraineeEnrollmentsResSchema,
  SubjectMes.TRAINEE_ENROLLMENTS_SUCCESS
) {}
export class GetTraineeCourseSubjectsResDto extends createResponseDto(
  GetTraineeCourseSubjectsResSchema,
  SubjectMes.TRAINEE_COURSE_SUBJECTS_SUCCESS
) {}
export class RemoveEnrollmentsBodyDto extends createZodDto(RemoveEnrollmentsBodySchema) {}
export class BulkCreateSubjectsResDto extends createResponseDto(
  BulkCreateSubjectsResSchema,
  SubjectMes.BULK_CREATE_SUCCESS
) {}
export class RemoveEnrollmentsResDto extends createResponseDto(
  RemoveEnrollmentsResSchema,
  SubjectMes.REMOVE_ENROLLMENTS_SUCCESS
) {}
export class CourseBatchParamsDto extends createZodDto(CourseBatchParamsSchema) {}
export class RemoveCourseEnrollmentsByBatchResDto extends createResponseDto(
  RemoveCourseEnrollmentsByBatchResSchema,
  SubjectMes.REMOVE_COURSE_ENROLLMENTS_BY_BATCH_SUCCESS
) {}
export class RemoveCourseTraineeEnrollmentsBodyDto extends createZodDto(RemoveCourseTraineeEnrollmentsBodySchema) {}
export class RemoveCourseTraineeEnrollmentsResDto extends createResponseDto(
  RemoveCourseTraineeEnrollmentsResSchema,
  SubjectMes.REMOVE_COURSE_TRAINEE_ENROLLMENTS_SUCCESS
) {}
export class GetSubjectEnrollmentsQueryDto extends createZodDto(GetSubjectEnrollmentsQuerySchema) {}
export class GetSubjectEnrollmentsResDto extends createZodDto(GetSubjectEnrollmentsResSchema) {}

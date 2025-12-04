import { createZodDto } from 'nestjs-zod'
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
import { SubjectIdParamsSchema, SubjectSchema } from '~/shared/models/shared-subject.model'
import { UserLookupResSchema } from '~/shared/models/shared-user.model'

export class SubjectSchemaDto extends createZodDto(SubjectSchema) {}
export class GetSubjectsQueryDto extends createZodDto(GetSubjectsQuerySchema) {}
export class GetSubjectsResDto extends createZodDto(GetSubjectsResSchema) {}
export class GetSubjectDetailResDto extends createZodDto(GetSubjectDetailResSchema) {}
export class GetAvailableTrainersResDto extends createZodDto(GetAvailableTrainersResSchema) {}
export class GetActiveTraineesResDto extends createZodDto(GetActiveTraineesResSchema) {}
export class SubjectIdParamsDto extends createZodDto(SubjectIdParamsSchema) {}
export class SubjectTrainerParamsDto extends createZodDto(SubjectTrainerParamsSchema) {}
export class SubjectTraineeParamsDto extends createZodDto(SubjectTraineeParamsSchema) {}
export class TraineeIdParamsDto extends createZodDto(TraineeIdParamsSchema) {}
export class CreateSubjectBodyDto extends createZodDto(CreateSubjectBodySchema) {}
export class BulkCreateSubjectsBodyDto extends createZodDto(BulkCreateSubjectsBodySchema) {}
export class UpdateSubjectBodyDto extends createZodDto(UpdateSubjectBodySchema) {}
export class AssignTrainerBodyDto extends createZodDto(AssignTrainerBodySchema) {}
export class AssignTrainerResDto extends createZodDto(AssignTrainerResSchema) {}
export class UpdateTrainerAssignmentBodyDto extends createZodDto(UpdateTrainerAssignmentBodySchema) {}
export class UpdateTrainerAssignmentResDto extends createZodDto(UpdateTrainerAssignmentResSchema) {}
export class LookupTraineesResDto extends createZodDto(UserLookupResSchema) {}
export class LookupTraineesBodyDto extends createZodDto(LookupTraineesBodySchema) {}
export class AssignTraineesBodyDto extends createZodDto(AssignTraineesBodySchema) {}
export class AssignTraineesResDto extends createZodDto(AssignTraineesResSchema) {}
export class CancelSubjectEnrollmentBodyDto extends createZodDto(CancelSubjectEnrollmentBodySchema) {}
export class GetEnrollmentsQueryDto extends createZodDto(GetEnrollmentsQuerySchema) {}
export class GetEnrollmentsResDto extends createZodDto(GetEnrollmentsResSchema) {}

export class GetTraineeEnrollmentsQueryDto extends createZodDto(GetTraineeEnrollmentsQuerySchema) {}
export class GetTraineeEnrollmentsResDto extends createZodDto(GetTraineeEnrollmentsResSchema) {}
export class GetTraineeCourseSubjectsResDto extends createZodDto(GetTraineeCourseSubjectsResSchema) {}
export class RemoveEnrollmentsBodyDto extends createZodDto(RemoveEnrollmentsBodySchema) {}
export class BulkCreateSubjectsResDto extends createZodDto(BulkCreateSubjectsResSchema) {}
export class RemoveEnrollmentsResDto extends createZodDto(RemoveEnrollmentsResSchema) {}
export class CourseBatchParamsDto extends createZodDto(CourseBatchParamsSchema) {}
export class RemoveCourseEnrollmentsByBatchResDto extends createZodDto(RemoveCourseEnrollmentsByBatchResSchema) {}
export class RemoveCourseTraineeEnrollmentsBodyDto extends createZodDto(RemoveCourseTraineeEnrollmentsBodySchema) {}
export class RemoveCourseTraineeEnrollmentsResDto extends createZodDto(RemoveCourseTraineeEnrollmentsResSchema) {}
export class GetSubjectEnrollmentsQueryDto extends createZodDto(GetSubjectEnrollmentsQuerySchema) {}
export class GetSubjectEnrollmentsResDto extends createZodDto(GetSubjectEnrollmentsResSchema) {}

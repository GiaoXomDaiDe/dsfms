import { createZodDto } from 'nestjs-zod'
import {
  AddInstructorsBodySchema,
  AddInstructorsResSchema,
  AssignTraineesBodySchema,
  AssignTraineesResSchema,
  AssignTrainerBodySchema,
  AssignTrainerResSchema,
  BatchAddTraineesToCourseBodySchema,
  BatchAddTraineesToCourseResSchema,
  BatchAddTraineesToSubjectBodySchema,
  BatchAddTraineesToSubjectResSchema,
  BulkCreateSubjectsBodySchema,
  BulkCreateSubjectsResSchema,
  BulkMultiSubjectEnrollmentBodySchema,
  BulkMultiSubjectEnrollmentResSchema,
  CancelCourseEnrollmentsResSchema,
  CancelSubjectEnrollmentBodySchema,
  CancelSubjectEnrollmentResSchema,
  CourseTraineesOverviewResSchema,
  CreateSubjectBodySchema,
  EnrollTraineesBodySchema,
  EnrollTraineesResSchema,
  GetAvailableTrainersResSchema,
  GetSubjectDetailResSchema,
  GetSubjectsQuerySchema,
  GetSubjectsResSchema,
  GetTraineeEnrollmentsQuerySchema,
  LookupTraineesBodySchema,
  RemoveEnrollmentsBodySchema,
  RemoveEnrollmentsResSchema,
  RemoveInstructorsBodySchema,
  RemoveInstructorsResSchema,
  SubjectStatsSchema,
  SubjectTraineeParamsSchema,
  SubjectTrainerParamsSchema,
  TraineeSubjectsOverviewResSchema,
  UpdateEnrollmentStatusBodySchema,
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
export class SubjectIdParamsDto extends createZodDto(SubjectIdParamsSchema) {}
export class SubjectTrainerParamsDto extends createZodDto(SubjectTrainerParamsSchema) {}
export class SubjectTraineeParamsDto extends createZodDto(SubjectTraineeParamsSchema) {}
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
export class CancelCourseEnrollmentsResDto extends createZodDto(CancelCourseEnrollmentsResSchema) {}
export class GetTraineeEnrollmentsQueryDto extends createZodDto(GetTraineeEnrollmentsQuerySchema) {}
export class CancelSubjectEnrollmentBodyDto extends createZodDto(CancelSubjectEnrollmentBodySchema) {}
export class CancelSubjectEnrollmentResDto extends createZodDto(CancelSubjectEnrollmentResSchema) {}
export class AddInstructorsBodyDto extends createZodDto(AddInstructorsBodySchema) {}
export class RemoveInstructorsBodyDto extends createZodDto(RemoveInstructorsBodySchema) {}
export class EnrollTraineesBodyDto extends createZodDto(EnrollTraineesBodySchema) {}
export class RemoveEnrollmentsBodyDto extends createZodDto(RemoveEnrollmentsBodySchema) {}
export class BatchAddTraineesToCourseBodyDto extends createZodDto(BatchAddTraineesToCourseBodySchema) {}
export class BatchAddTraineesToSubjectBodyDto extends createZodDto(BatchAddTraineesToSubjectBodySchema) {}
export class BulkCreateSubjectsResDto extends createZodDto(BulkCreateSubjectsResSchema) {}
export class UpdateEnrollmentStatusBodyDto extends createZodDto(UpdateEnrollmentStatusBodySchema) {}
export class SubjectStatsDto extends createZodDto(SubjectStatsSchema) {}
export class AddInstructorsResDto extends createZodDto(AddInstructorsResSchema) {}
export class RemoveInstructorsResDto extends createZodDto(RemoveInstructorsResSchema) {}
export class EnrollTraineesResDto extends createZodDto(EnrollTraineesResSchema) {}
export class RemoveEnrollmentsResDto extends createZodDto(RemoveEnrollmentsResSchema) {}
export class BatchAddTraineesToCourseResDto extends createZodDto(BatchAddTraineesToCourseResSchema) {}
export class BatchAddTraineesToSubjectResDto extends createZodDto(BatchAddTraineesToSubjectResSchema) {}
export class BulkMultiSubjectEnrollmentBodyDto extends createZodDto(BulkMultiSubjectEnrollmentBodySchema) {}
export class BulkMultiSubjectEnrollmentResDto extends createZodDto(BulkMultiSubjectEnrollmentResSchema) {}
export class CourseTraineesOverviewResDto extends createZodDto(CourseTraineesOverviewResSchema) {}
export class TraineeSubjectsOverviewResDto extends createZodDto(TraineeSubjectsOverviewResSchema) {}

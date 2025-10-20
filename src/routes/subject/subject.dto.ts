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
  GetAvailableTrainersQuerySchema,
  GetAvailableTrainersResSchema,
  GetSubjectsQuerySchema,
  GetSubjectsResSchema,
  GetSubjectsSchema,
  GetTraineeEnrollmentsQuerySchema,
  LookupTraineesBodySchema,
  RemoveEnrollmentsBodySchema,
  RemoveEnrollmentsResSchema,
  RemoveInstructorsBodySchema,
  RemoveInstructorsResSchema,
  RemoveTrainerResSchema,
  SubjectDetailResSchema,
  SubjectResSchema,
  SubjectStatsSchema,
  TraineeSubjectsOverviewResSchema,
  UpdateEnrollmentStatusBodySchema,
  UpdateSubjectBodySchema,
  UpdateTrainerAssignmentBodySchema,
  UpdateTrainerAssignmentResSchema
} from '~/routes/subject/subject.model'
import { UserLookupResSchema } from '~/shared/models/shared-user-list.model'

export class GetSubjectsQueryDto extends createZodDto(GetSubjectsQuerySchema) {}
export class GetSubjectsDto extends createZodDto(GetSubjectsSchema) {}
export class GetSubjectsResDto extends createZodDto(GetSubjectsResSchema) {}
export class SubjectResDto extends createZodDto(SubjectResSchema) {}

export class GetAvailableTrainersQueryDto extends createZodDto(GetAvailableTrainersQuerySchema) {}
export class GetAvailableTrainersResDto extends createZodDto(GetAvailableTrainersResSchema) {}
export class AssignTrainerBodyDto extends createZodDto(AssignTrainerBodySchema) {}
export class AssignTrainerResDto extends createZodDto(AssignTrainerResSchema) {}
export class UpdateTrainerAssignmentBodyDto extends createZodDto(UpdateTrainerAssignmentBodySchema) {}
export class UpdateTrainerAssignmentResDto extends createZodDto(UpdateTrainerAssignmentResSchema) {}
export class RemoveTrainerResDto extends createZodDto(RemoveTrainerResSchema) {}
export class LookupTraineesBodyDto extends createZodDto(LookupTraineesBodySchema) {}
export class LookupTraineesResDto extends createZodDto(UserLookupResSchema) {}
export class AssignTraineesBodyDto extends createZodDto(AssignTraineesBodySchema) {}
export class AssignTraineesResDto extends createZodDto(AssignTraineesResSchema) {}

export class CancelCourseEnrollmentsResDto extends createZodDto(CancelCourseEnrollmentsResSchema) {}
export class GetTraineeEnrollmentsQueryDto extends createZodDto(GetTraineeEnrollmentsQuerySchema) {}

export class CancelSubjectEnrollmentBodyDto extends createZodDto(CancelSubjectEnrollmentBodySchema) {}
export class CancelSubjectEnrollmentResDto extends createZodDto(CancelSubjectEnrollmentResSchema) {}
export class CreateSubjectBodyDto extends createZodDto(CreateSubjectBodySchema) {}
export class UpdateSubjectBodyDto extends createZodDto(UpdateSubjectBodySchema) {}

export class SubjectDetailResDto extends createZodDto(SubjectDetailResSchema) {}
export class AddInstructorsBodyDto extends createZodDto(AddInstructorsBodySchema) {}
export class RemoveInstructorsBodyDto extends createZodDto(RemoveInstructorsBodySchema) {}
export class EnrollTraineesBodyDto extends createZodDto(EnrollTraineesBodySchema) {}
export class RemoveEnrollmentsBodyDto extends createZodDto(RemoveEnrollmentsBodySchema) {}
export class BatchAddTraineesToCourseBodyDto extends createZodDto(BatchAddTraineesToCourseBodySchema) {}
export class BatchAddTraineesToSubjectBodyDto extends createZodDto(BatchAddTraineesToSubjectBodySchema) {}
export class BulkCreateSubjectsBodyDto extends createZodDto(BulkCreateSubjectsBodySchema) {}
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

import { createZodDto } from 'nestjs-zod'
import {
  AssignTraineesBodySchema,
  AssignTraineesResSchema,
  AssignTrainerBodySchema,
  AssignTrainerResSchema,
  CancelCourseEnrollmentsResSchema,
  CancelSubjectEnrollmentBodySchema,
  CancelSubjectEnrollmentResSchema,
  GetAvailableTrainersQuerySchema,
  GetAvailableTrainersResSchema,
  GetTraineeEnrollmentsQuerySchema,
  LookupTraineesBodySchema,
  RemoveTrainerResSchema,
  UpdateTrainerAssignmentBodySchema,
  UpdateTrainerAssignmentResSchema
} from '~/routes/subject/subject.model'
import { UserLookupResSchema } from '~/shared/models/shared-user-list.model'

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

import { createZodDto } from 'nestjs-zod'
import {
  CreateAssessmentBodySchema,
  CreateBulkAssessmentBodySchema,
  CreateAssessmentResSchema,
  CreateBulkAssessmentResSchema,
  GetAssessmentsQuerySchema,
  GetAssessmentParamsSchema,
  GetAssessmentsResSchema,
  GetAssessmentDetailResSchema,
  AssessmentFormResSchema,
  AssessmentSectionResSchema,
  AssessmentValueResSchema,
  GetSubjectAssessmentsQuerySchema,
  GetCourseAssessmentsQuerySchema,
  GetSubjectAssessmentsResSchema,
  GetCourseAssessmentsResSchema,
  TrainerAssessmentListItemSchema
} from './assessment.model'

// ===== REQUEST DTOs =====

export class CreateAssessmentBodyDTO extends createZodDto(CreateAssessmentBodySchema) {}

export class CreateBulkAssessmentBodyDTO extends createZodDto(CreateBulkAssessmentBodySchema) {}

export class GetAssessmentsQueryDTO extends createZodDto(GetAssessmentsQuerySchema) {}

export class GetAssessmentParamsDTO extends createZodDto(GetAssessmentParamsSchema) {}

// ===== RESPONSE DTOs =====

export class CreateAssessmentResDTO extends createZodDto(CreateAssessmentResSchema) {}

export class CreateBulkAssessmentResDTO extends createZodDto(CreateBulkAssessmentResSchema) {}

export class GetAssessmentsResDTO extends createZodDto(GetAssessmentsResSchema) {}

export class GetAssessmentDetailResDTO extends createZodDto(GetAssessmentDetailResSchema) {}

export class AssessmentFormResDTO extends createZodDto(AssessmentFormResSchema) {}

export class AssessmentSectionResDTO extends createZodDto(AssessmentSectionResSchema) {}

export class AssessmentValueResDTO extends createZodDto(AssessmentValueResSchema) {}

// ===== TRAINER ASSESSMENT DTOs =====

export class GetSubjectAssessmentsQueryDTO extends createZodDto(GetSubjectAssessmentsQuerySchema) {}

export class GetCourseAssessmentsQueryDTO extends createZodDto(GetCourseAssessmentsQuerySchema) {}

export class GetSubjectAssessmentsResDTO extends createZodDto(GetSubjectAssessmentsResSchema) {}

export class GetCourseAssessmentsResDTO extends createZodDto(GetCourseAssessmentsResSchema) {}

export class TrainerAssessmentListItemDTO extends createZodDto(TrainerAssessmentListItemSchema) {}

// ===== TYPE EXPORTS =====

export type {
  CreateAssessmentBodyType,
  CreateBulkAssessmentBodyType,
  CreateAssessmentResType,
  CreateBulkAssessmentResType,
  GetAssessmentsQueryType,
  GetAssessmentParamsType,
  GetAssessmentsResType,
  GetAssessmentDetailResType,
  AssessmentFormResType,
  AssessmentSectionResType,
  AssessmentValueResType,
  AssessmentFormType,
  AssessmentSectionType,
  AssessmentValueType,
  GetSubjectAssessmentsQueryType,
  GetCourseAssessmentsQueryType,
  GetSubjectAssessmentsResType,
  GetCourseAssessmentsResType,
  TrainerAssessmentListItemType
} from './assessment.model'
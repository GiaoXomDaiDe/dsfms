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
  AssessmentValueResSchema
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
  AssessmentValueType
} from './assessment.model'
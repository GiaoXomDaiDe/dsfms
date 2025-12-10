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
  TrainerAssessmentListItemSchema,
  GetAssessmentSectionsQuerySchema,
  GetAssessmentSectionsResSchema,
  GetAssessmentSectionFieldsQuerySchema,
  GetAssessmentSectionFieldsResSchema,
  SaveAssessmentValuesBodySchema,
  SaveAssessmentValuesResSchema,
  ToggleTraineeLockBodySchema,
  ToggleTraineeLockResSchema,
  SubmitAssessmentParamsSchema,
  SubmitAssessmentResSchema,
  UpdateAssessmentValuesBodySchema,
  UpdateAssessmentValuesResSchema,
  ConfirmAssessmentParticipationBodySchema,
  ConfirmAssessmentParticipationResSchema,
  GetDepartmentAssessmentsQuerySchema,
  GetDepartmentAssessmentsResSchema,
  ApproveRejectAssessmentBodySchema,
  ApproveRejectAssessmentResSchema,
  RenderDocxTemplateBodySchema,
  RenderDocxTemplateResSchema,
  GetAssessmentEventsQuerySchema,
  GetAssessmentEventsResSchema,
  GetUserAssessmentEventsQuerySchema,
  GetUserAssessmentEventsResSchema,
  UpdateAssessmentEventBodySchema,
  UpdateAssessmentEventParamsSchema,
  UpdateAssessmentEventResSchema,
  GetEventSubjectAssessmentsBodySchema,
  GetEventSubjectAssessmentsQuerySchema,
  GetEventSubjectAssessmentsResSchema,
  GetEventCourseAssessmentsBodySchema,
  GetEventCourseAssessmentsQuerySchema,
  GetEventCourseAssessmentsResSchema,
  ArchiveAssessmentEventBodySchema,
  ArchiveAssessmentEventResSchema
} from './assessment.model'

// ===== REQUEST DTOs =====

export class CreateAssessmentBodyDTO extends createZodDto(CreateAssessmentBodySchema) {}

export class CreateBulkAssessmentBodyDTO extends createZodDto(CreateBulkAssessmentBodySchema) {}

export class GetAssessmentsQueryDTO extends createZodDto(GetAssessmentsQuerySchema) {}

export class GetAssessmentParamsDTO extends createZodDto(GetAssessmentParamsSchema) {}

export class GetDepartmentAssessmentsQueryDTO extends createZodDto(GetDepartmentAssessmentsQuerySchema) {}

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

export class GetAssessmentSectionsQueryDTO extends createZodDto(GetAssessmentSectionsQuerySchema) {}

export class GetAssessmentSectionsResDTO extends createZodDto(GetAssessmentSectionsResSchema) {}

export class GetAssessmentSectionFieldsQueryDTO extends createZodDto(GetAssessmentSectionFieldsQuerySchema) {}

export class GetAssessmentSectionFieldsResDTO extends createZodDto(GetAssessmentSectionFieldsResSchema) {}

// ===== SAVE ASSESSMENT VALUES DTOs =====

export class SaveAssessmentValuesBodyDTO extends createZodDto(SaveAssessmentValuesBodySchema) {}

export class SaveAssessmentValuesResDTO extends createZodDto(SaveAssessmentValuesResSchema) {}

// ===== TOGGLE TRAINEE LOCK DTOs =====

export class ToggleTraineeLockBodyDTO extends createZodDto(ToggleTraineeLockBodySchema) {}

export class ToggleTraineeLockResDTO extends createZodDto(ToggleTraineeLockResSchema) {}

// ===== SUBMIT ASSESSMENT DTOs =====

export class SubmitAssessmentParamsDTO extends createZodDto(SubmitAssessmentParamsSchema) {}

export class SubmitAssessmentResDTO extends createZodDto(SubmitAssessmentResSchema) {}

// ===== UPDATE ASSESSMENT VALUES DTOs =====

export class UpdateAssessmentValuesBodyDTO extends createZodDto(UpdateAssessmentValuesBodySchema) {}

export class UpdateAssessmentValuesResDTO extends createZodDto(UpdateAssessmentValuesResSchema) {}

export class ConfirmAssessmentParticipationBodyDTO extends createZodDto(ConfirmAssessmentParticipationBodySchema) {}

export class ConfirmAssessmentParticipationResDTO extends createZodDto(ConfirmAssessmentParticipationResSchema) {}

export class GetDepartmentAssessmentsResDTO extends createZodDto(GetDepartmentAssessmentsResSchema) {}

// ===== APPROVE/REJECT ASSESSMENT DTOs =====

export class ApproveRejectAssessmentBodyDTO extends createZodDto(ApproveRejectAssessmentBodySchema) {}

export class ApproveRejectAssessmentResDTO extends createZodDto(ApproveRejectAssessmentResSchema) {}

// ===== ASSESSMENT EVENT DTOs =====

export class GetAssessmentEventsQueryDTO extends createZodDto(GetAssessmentEventsQuerySchema) {}

export class GetAssessmentEventsResDTO extends createZodDto(GetAssessmentEventsResSchema) {}

export class GetUserAssessmentEventsQueryDTO extends createZodDto(GetUserAssessmentEventsQuerySchema) {}

export class GetUserAssessmentEventsResDTO extends createZodDto(GetUserAssessmentEventsResSchema) {}

export class UpdateAssessmentEventBodyDTO extends createZodDto(UpdateAssessmentEventBodySchema) {}

export class UpdateAssessmentEventParamsDTO extends createZodDto(UpdateAssessmentEventParamsSchema) {}

export class UpdateAssessmentEventResDTO extends createZodDto(UpdateAssessmentEventResSchema) {}

// ===== EVENT ASSESSMENTS DTOs =====

export class GetEventSubjectAssessmentsBodyDTO extends createZodDto(GetEventSubjectAssessmentsBodySchema) {}

export class GetEventSubjectAssessmentsQueryDTO extends createZodDto(GetEventSubjectAssessmentsQuerySchema) {}

export class GetEventSubjectAssessmentsResDTO extends createZodDto(GetEventSubjectAssessmentsResSchema) {}

export class GetEventCourseAssessmentsBodyDTO extends createZodDto(GetEventCourseAssessmentsBodySchema) {}

export class GetEventCourseAssessmentsQueryDTO extends createZodDto(GetEventCourseAssessmentsQuerySchema) {}

export class GetEventCourseAssessmentsResDTO extends createZodDto(GetEventCourseAssessmentsResSchema) {}

// ===== ARCHIVE ASSESSMENT EVENT DTOs =====

export class ArchiveAssessmentEventBodyDTO extends createZodDto(ArchiveAssessmentEventBodySchema) {}

export class ArchiveAssessmentEventResDTO extends createZodDto(ArchiveAssessmentEventResSchema) {}

// ===== DOCX TEMPLATE RENDERING DTOs =====

export class RenderDocxTemplateBodyDTO extends createZodDto(RenderDocxTemplateBodySchema) {}

export class RenderDocxTemplateResDTO extends createZodDto(RenderDocxTemplateResSchema) {}

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
  TrainerAssessmentListItemType,
  GetAssessmentSectionsQueryType,
  GetAssessmentSectionsResType,
  GetAssessmentSectionFieldsQueryType,
  GetAssessmentSectionFieldsResType,
  GetUserAssessmentEventsQueryType,
  GetUserAssessmentEventsResType,
  RenderDocxTemplateBodyType,
  RenderDocxTemplateResType,
  ArchiveAssessmentEventBodyType,
  ArchiveAssessmentEventResType
} from './assessment.model'

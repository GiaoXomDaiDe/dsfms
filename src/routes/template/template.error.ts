import {
  BadRequestException,
  NotFoundException
} from '@nestjs/common'

// ==================== Core Template Errors ====================

export class TemplateNotFoundError extends NotFoundException {
  constructor(templateId?: string) {
    super(templateId ? `Template with ID '${templateId}' not found` : 'Template not found')
  }
}

export class TemplateNameAlreadyExistsError extends BadRequestException {
  constructor(name: string) {
    super(`Template name '${name}' already exists`)
  }
}

export class OriginalTemplateNotFoundError extends BadRequestException {
  constructor() {
    super('Original template not found')
  }
}

export class TemplateCreationFailedError extends BadRequestException {
  constructor(reason: string) {
    super(`Failed to create template: ${reason}`)
  }
}

export class TemplateVersionCreationError extends BadRequestException {
  constructor(reason: string) {
    super(`Failed to create template version: ${reason}`)
  }
}

export class TemplateHasAssessmentsError extends BadRequestException {
  constructor() {
    super('Cannot change department for templates that have been used to create assessment forms')
  }
}

// ==================== Department Validation Errors ====================

export class DepartmentNotFoundError extends BadRequestException {
  constructor(departmentId: string) {
    super(`Department with ID '${departmentId}' does not exist`)
  }
}

// ==================== File Processing Errors ====================

export class InvalidFileTypeError extends BadRequestException {
  constructor() {
    super('Only .docx files are allowed')
  }
}

export class DocxParsingError extends BadRequestException {
  constructor(details: string) {
    super(`Failed to parse template: ${details}`)
  }
}

// ==================== S3 Related Errors ====================

export class S3DownloadError extends BadRequestException {
  constructor(status?: number, statusText?: string) {
    super(status && statusText 
      ? `Failed to download file from S3: ${status} ${statusText}`
      : 'Failed to download file from S3'
    )
  }
}

export class S3FetchError extends BadRequestException {
  constructor(message: string) {
    super(`Failed to download file from S3: ${message}`)
  }
}

export class S3DocxParsingError extends BadRequestException {
  constructor(details: string) {
    super(`Failed to parse template from S3: ${details}`)
  }
}

export class S3ExtractionError extends BadRequestException {
  constructor(message?: string) {
    super(`Failed to extract fields from S3 URL: ${message || 'Unknown error'}`)
  }
}

// ==================== Template Configuration Errors ====================

export class TemplateConfigRequiredError extends BadRequestException {
  constructor() {
    super('templateConfig is required - must provide S3 URL to the original DOCX template')
  }
}

// ==================== Field Validation Errors ====================

export class RoleRequiredMismatchError extends BadRequestException {
  constructor(fieldName: string, sectionLabel: string, fieldRole: string, sectionRole: string) {
    super(`Field '${fieldName}' in section '${sectionLabel}' has required Role ='${fieldRole}' which does not match section.editBy='${sectionRole}'`)
  }
}

export class SignatureFieldMissingRoleError extends BadRequestException {
  constructor(fieldName: string, sectionLabel: string) {
    super(`Signature field '${fieldName}' in section '${sectionLabel}' must have roleRequired set to either TRAINEE or TRAINER`)
  }
}

export class PartFieldMissingChildrenError extends BadRequestException {
  constructor(fieldName: string, sectionLabel: string) {
    super(`PART field '${fieldName}' in section '${sectionLabel}' must have at least one child field`)
  }
}

// ==================== Template Status Errors ====================

export class InvalidTemplateStatusForUpdateError extends BadRequestException {
  constructor(currentStatus: string) {
    super(`Only REJECTED templates can be updated using this endpoint. Current status: ${currentStatus}`)
  }
}

export class TemplateInUseCannotUpdateError extends BadRequestException {
  constructor() {
    super('Cannot update template that has been used to create assessment forms. Template is currently being used in active assessments.')
  }
}

export class InvalidDraftTemplateStatusError extends BadRequestException {
  constructor(currentStatus: string) {
    super(`Cannot update template with status '${currentStatus}'. Only DRAFT templates can be updated using this endpoint.`)
  }
}

// ==================== New Field Validation Errors ====================

export class ToggleDependentSectionMissingControlError extends BadRequestException {
  constructor(sectionLabel: string) {
    super(`Section '${sectionLabel}' has isToggleDependent=true but missing required SECTION_CONTROL_TOGGLE field`)
  }
}

export class ValueListFieldMissingOptionsError extends BadRequestException {
  constructor(fieldName: string, sectionLabel: string) {
    super(`Field '${fieldName}' in section '${sectionLabel}' has fieldType=VALUE_LIST but missing required options field`)
  }
}

export class ValueListFieldInvalidOptionsError extends BadRequestException {
  constructor(fieldName: string, sectionLabel: string) {
    super(`Field '${fieldName}' in section '${sectionLabel}' has invalid options format. Expected: {"items": ["value1", "value2"]}`)
  }
}

export class MissingSignatureFieldError extends BadRequestException {
  constructor() {
    super('Template must have at least one field with fieldType SIGNATURE_DRAW or SIGNATURE_IMG')
  }
}

export class MissingFinalScoreFieldsError extends BadRequestException {
  constructor(missingType: 'FINAL_SCORE_NUM' | 'FINAL_SCORE_TEXT') {
    super(`Template must have exactly one field with fieldType ${missingType}`)
  }
}

export class DuplicateFinalScoreFieldsError extends BadRequestException {
  constructor(fieldType: 'FINAL_SCORE_NUM' | 'FINAL_SCORE_TEXT') {
    super(`Template can only have one field with fieldType ${fieldType}`)
  }
}

export class InvalidFieldTypeError extends BadRequestException {
  constructor(fieldType?: string) {
    const validTypes = 'TEXT, IMAGE, PART, TOGGLE, SECTION_CONTROL_TOGGLE, VALUE_LIST, SIGNATURE_DRAW, SIGNATURE_IMG, FINAL_SCORE_TEXT, FINAL_SCORE_NUM, CHECK_BOX'
    super(fieldType 
      ? `Invalid field type '${fieldType}'. Please use one of the following valid field types: ${validTypes}`
      : `Invalid field type. Please use one of the following valid field types: ${validTypes}`
    )
  }
}

export class DuplicateFieldNameError extends BadRequestException {
  constructor(fieldName?: string) {
    super(fieldName 
      ? `Duplicate field name '${fieldName}' detected within the same section and parent. Please ensure field names are unique within the same parent group.`
      : 'Duplicate field name detected within the same section and parent. Please ensure field names are unique within the same parent group.'
    )
  }
}

export class InvalidReferenceError extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Invalid reference detected. Please check that all department IDs and parent field references are valid.')
  }
}

export class CheckBoxFieldInvalidChildTypeError extends BadRequestException {
  constructor(fieldName: string, childFieldType: string, childFieldName: string) {
    super(`CHECK_BOX field '${fieldName}' can only contain TEXT fields. Found '${childFieldType}' in field '${childFieldName}'`)
  }
}

export class PartFieldInvalidChildTypeError extends BadRequestException {
  constructor(fieldName: string, childFieldType: string, childFieldName: string, restrictedTypes: string[]) {
    super(`PART field '${fieldName}' cannot contain '${childFieldType}' field type. Found in field '${childFieldName}'. Restricted types: ${restrictedTypes.join(', ')}`)
  }
}

export class FinalScoreTextRequiredOptionsError extends BadRequestException {
  constructor() {
    super('FINAL_SCORE_TEXT field must have options when FINAL_SCORE_NUM field is not present')
  }
}

export class FinalScoreTextInvalidOptionsError extends BadRequestException {
  constructor() {
    super('FINAL_SCORE_TEXT field options must have "items" array with at least one value when FINAL_SCORE_NUM field is not present')
  }
}

export class FinalScoreTextInvalidJsonError extends BadRequestException {
  constructor() {
    super('FINAL_SCORE_TEXT field options must be valid JSON with "items" array when FINAL_SCORE_NUM field is not present')
  }
}

export class CheckBoxFieldMissingChildrenError extends BadRequestException {
  constructor(fieldName: string, sectionLabel: string) {
    super(`CHECK_BOX field '${fieldName}' in section '${sectionLabel}' must have at least one child field`)
  }
}
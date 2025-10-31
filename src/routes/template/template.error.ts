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
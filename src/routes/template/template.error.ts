import { 
  BadRequestException, 
  ForbiddenException, 
  NotFoundException, 
  UnauthorizedException,
  UnprocessableEntityException 
} from '@nestjs/common';

export class TemplateNotFoundError extends NotFoundException {
  constructor(templateId?: string) {
    super(templateId 
      ? `Template with ID '${templateId}' not found` 
      : 'Template not found'
    );
  }
}

export class TemplateAlreadyExistsError extends UnprocessableEntityException {
  constructor(templateName: string) {
    super([
      {
        message: `Template with name '${templateName}' already exists in this department`,
        path: 'name'
      }
    ]);
  }
}

export class InactiveTemplateError extends BadRequestException {
  constructor(templateId: string) {
    super(`Template with ID '${templateId}' is inactive and cannot be used`);
  }
}

// ==================== Department Validation Errors ====================

export class DepartmentNotFoundError extends BadRequestException {
  constructor(departmentId: string) {
    super(`Department with ID '${departmentId}' does not exist`);
  }
}

export class InactiveDepartmentError extends BadRequestException {
  constructor(departmentId: string) {
    super(`Department with ID '${departmentId}' is inactive`);
  }
}

// ==================== Permission & Authorization Errors ====================

export class UnauthorizedTemplateAccessError extends UnauthorizedException {
  constructor() {
    super('You are not authorized to access this template');
  }
}

export class InsufficientPermissionsError extends ForbiddenException {
  constructor(action: string = 'perform this action') {
    super(`You do not have sufficient permissions to ${action}`);
  }
}

export class OnlyAdministratorCanCreateTemplateError extends ForbiddenException {
  constructor() {
    super('Only ADMINISTRATOR role can create templates');
  }
}

export class OnlyAdministratorCanUpdateTemplateError extends ForbiddenException {
  constructor() {
    super('Only ADMINISTRATOR role can update templates');
  }
}

export class OnlyAdministratorCanDeleteTemplateError extends ForbiddenException {
  constructor() {
    super('Only ADMINISTRATOR role can delete templates');
  }
}

// ==================== Template Section Errors ====================

export class TemplateSectionNotFoundError extends NotFoundException {
  constructor(sectionId?: string) {
    super(sectionId
      ? `Template section with ID '${sectionId}' not found`
      : 'Template section not found'
    );
  }
}

export class DuplicateSectionOrderError extends BadRequestException {
  constructor(order: number) {
    super(`Section with display order ${order} already exists in this template`);
  }
}

export class InvalidSectionOrderError extends BadRequestException {
  constructor() {
    super('Section display order must be a positive integer');
  }
}

export class EmptySectionFieldsError extends BadRequestException {
  constructor() {
    super('Template section must have at least one field');
  }
}

export class InvalidEditByRoleError extends BadRequestException {
  constructor() {
    super('Invalid editBy role. Must be either TRAINEE or TRAINER');
  }
}

export class InvalidRoleInSubjectError extends BadRequestException {
  constructor() {
    super('Invalid roleInSubject. Must be either EXAMINER or ASSESSMENT_REVIEWER');
  }
}

// ==================== Template Field Errors ====================

export class TemplateFieldNotFoundError extends NotFoundException {
  constructor(fieldId?: string) {
    super(fieldId
      ? `Template field with ID '${fieldId}' not found`
      : 'Template field not found'
    );
  }
}

export class DuplicateFieldNameError extends BadRequestException {
  constructor(fieldName: string) {
    super(`Field with name '${fieldName}' already exists in this section`);
  }
}

export class DuplicateFieldOrderError extends BadRequestException {
  constructor(order: number) {
    super(`Field with display order ${order} already exists in this section`);
  }
}

export class InvalidFieldOrderError extends BadRequestException {
  constructor() {
    super('Field display order must be a positive integer');
  }
}

export class InvalidFieldTypeError extends BadRequestException {
  constructor(fieldType?: string) {
    super(fieldType
      ? `Invalid field type '${fieldType}'. Must be one of: TEXT, IMAGE, PART, TOGGLE, SECTION_CONTROL_TOGGLE, VALUE_LIST, SIGNATURE_DRAW, SIGNATURE_IMG, FINAL_SCORE_TEXT, FINAL_SCORE_NUM, CHECK_BOX`
      : 'Invalid field type provided'
    );
  }
}

export class InvalidRoleRequiredError extends BadRequestException {
  constructor() {
    super('Invalid roleRequired. Must be either TRAINEE or TRAINER');
  }
}

export class InvalidParentFieldError extends BadRequestException {
  constructor(parentId?: string) {
    super(parentId
      ? `Parent field with ID '${parentId}' does not exist or is invalid`
      : 'Invalid parent field ID or parent field does not exist'
    );
  }
}

export class CircularFieldReferenceError extends BadRequestException {
  constructor() {
    super('Cannot set parent field - this would create a circular reference');
  }
}

export class ParentFieldNotInSameSectionError extends BadRequestException {
  constructor() {
    super('Parent field must be in the same section as the child field');
  }
}

export class MissingFieldOptionsError extends BadRequestException {
  constructor(fieldType: string) {
    super(`Field of type '${fieldType}' requires options to be provided`);
  }
}

export class InvalidFieldOptionsError extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Invalid field options format');
  }
}

export class InvalidFileTypeError extends BadRequestException {
  constructor() {
    super('Only .docx files are allowed');
  }
}

export class NoFileUploadedError extends BadRequestException {
  constructor() {
    super('No file uploaded');
  }
}

export class DocxParsingError extends BadRequestException {
  constructor(details?: string) {
    super(details 
      ? `Failed to parse DOCX template: ${details}`
      : 'Failed to parse DOCX template'
    );
  }
}

export class InvalidDocxTemplateError extends BadRequestException {
  constructor(reason?: string) {
    super(reason
      ? `Invalid DOCX template: ${reason}`
      : 'Invalid DOCX template format'
    );
  }
}

export class EmptyDocxTemplateError extends BadRequestException {
  constructor() {
    super('DOCX template is empty or contains no placeholders');
  }
}

// ==================== Template Creation Errors ====================

export class EmptyTemplateSectionsError extends BadRequestException {
  constructor() {
    super('Template must have at least one section');
  }
}

export class InvalidTemplateNameError extends BadRequestException {
  constructor() {
    super('Template name is required and must not be empty');
  }
}

export class TemplateNameTooLongError extends BadRequestException {
  constructor(maxLength: number = 255) {
    super(`Template name must not exceed ${maxLength} characters`);
  }
}

export class InvalidTemplateDescriptionError extends BadRequestException {
  constructor() {
    super('Template description is too long or contains invalid characters');
  }
}

export class TemplateCreationFailedError extends BadRequestException {
  constructor(reason?: string) {
    super(reason
      ? `Failed to create template: ${reason}`
      : 'Failed to create template'
    );
  }
}

export class TemplateUpdateFailedError extends BadRequestException {
  constructor(reason?: string) {
    super(reason
      ? `Failed to update template: ${reason}`
      : 'Failed to update template'
    );
  }
}

export class TemplateDeletionFailedError extends BadRequestException {
  constructor(reason?: string) {
    super(reason
      ? `Failed to delete template: ${reason}`
      : 'Failed to delete template'
    );
  }
}

// ==================== Template Schema Errors ====================

export class InvalidTemplateSchemaError extends BadRequestException {
  constructor(reason?: string) {
    super(reason
      ? `Invalid template schema: ${reason}`
      : 'Invalid template schema format'
    );
  }
}

export class TemplateSchemaGenerationError extends BadRequestException {
  constructor(reason?: string) {
    super(reason
      ? `Failed to generate template schema: ${reason}`
      : 'Failed to generate template schema'
    );
  }
}

// ==================== Template Version Errors ====================

export class InvalidTemplateVersionError extends BadRequestException {
  constructor() {
    super('Template version must be a positive integer');
  }
}

export class TemplateVersionConflictError extends BadRequestException {
  constructor(currentVersion: number) {
    super(`Template has been modified. Current version is ${currentVersion}`);
  }
}

// ==================== Validation Errors ====================

export class InvalidUUIDError extends BadRequestException {
  constructor(fieldName: string) {
    super(`Invalid UUID format for field '${fieldName}'`);
  }
}

export class MissingRequiredFieldError extends BadRequestException {
  constructor(fieldName: string) {
    super(`Required field '${fieldName}' is missing`);
  }
}

export class FieldValidationError extends BadRequestException {
  constructor(fieldName: string, reason: string) {
    super(`Validation failed for field '${fieldName}': ${reason}`);
  }
}


export class TransactionFailedError extends BadRequestException {
  constructor(reason?: string) {
    super(reason
      ? `Transaction failed: ${reason}`
      : 'Database transaction failed'
    );
  }
}

export class ConcurrentModificationError extends BadRequestException {
  constructor() {
    super('Template is being modified by another user. Please try again');
  }
}

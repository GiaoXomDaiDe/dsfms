/**
 * Template success messages for consistent response messaging
 */

// ==================== Template Parsing Messages ====================
export const TEMPLATE_PARSED_SUCCESSFULLY = 'Template parsed successfully'

export const TEMPLATE_FIELDS_EXTRACTED = (count: number) => 
  `Extracted ${count} unique fields from document`

export const TEMPLATE_FIELDS_EXTRACTED_FROM_S3 = (count: number) => 
  `Extracted ${count} unique fields from S3 document`

// ==================== Template CRUD Messages ====================
export const TEMPLATE_CREATED_SUCCESSFULLY = 'Template created successfully'

export const TEMPLATE_RETRIEVED_SUCCESSFULLY = 'Template retrieved successfully'

export const TEMPLATE_SCHEMA_RETRIEVED_SUCCESSFULLY = 'Template schema retrieved successfully'

export const TEMPLATES_RETRIEVED_SUCCESSFULLY = 'Templates retrieved successfully'

export const DEPARTMENT_TEMPLATES_RETRIEVED_SUCCESSFULLY = 'Department templates retrieved successfully'

export const TEMPLATE_UPDATED_SUCCESSFULLY = 'Template updated successfully'

export const TEMPLATE_STATUS_UPDATED_SUCCESSFULLY = (status: string) => 
  `Template status updated to ${status} successfully`

export const TEMPLATE_DELETED_SUCCESSFULLY = (templateName: string) =>
  `Template '${templateName}' deleted successfully`

// ==================== Template Version Messages ====================
export const TEMPLATE_VERSION_CREATED_SUCCESSFULLY = 'Template version created successfully'
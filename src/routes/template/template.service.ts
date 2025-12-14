import { Injectable } from '@nestjs/common'
import PizZip = require('pizzip')
import Docxtemplater = require('docxtemplater')
import JSZip from 'jszip'
import { TemplateRepository } from './template.repository'
import {
  CreateTemplateFormDto,
  UpdateTemplateFormDto,
  CreateTemplateVersionDto,
  ReviewTemplateBodyType,
  ReviewTemplateResType
} from './template.dto'
import { PdfConverterService } from '~/shared/services/pdf-converter.service'
import { NodemailerService } from '../email/nodemailer.service'
import {
  InvalidFileTypeError,
  DocxParsingError,
  TemplateConfigRequiredError,
  DepartmentNotFoundError,
  TemplateNameAlreadyExistsError,
  RoleRequiredMismatchError,
  SignatureFieldMissingRoleError,
  PartFieldMissingChildrenError,
  TemplateCreationFailedError,
  TemplateNotFoundError,
  S3DownloadError,
  S3FetchError,
  S3DocxParsingError,
  S3ExtractionError,
  OriginalTemplateNotFoundError,
  TemplateHasAssessmentsError,
  TemplateVersionCreationError,
  InvalidTemplateStatusForUpdateError,
  InvalidDraftTemplateStatusError,
  ToggleDependentSectionMissingControlError,
  ValueListFieldMissingOptionsError,
  ValueListFieldInvalidOptionsError,
  MissingSignatureFieldError,
  MissingSubmittableSectionError,
  MissingFinalScoreFieldsError,
  DuplicateFinalScoreFieldsError,
  InvalidFieldTypeError,
  DuplicateFieldNameError,
  InvalidReferenceError,
  CheckBoxFieldInvalidChildTypeError,
  PartFieldInvalidChildTypeError,
  FinalScoreTextRequiredOptionsError,
  FinalScoreTextInvalidOptionsError,
  FinalScoreTextInvalidJsonError,
  CheckBoxFieldMissingChildrenError,
  InvalidStatusTransitionError,
  TemplateInUseCannotDisableError
} from './template.error'
import {
  TEMPLATE_PARSED_SUCCESSFULLY,
  TEMPLATE_FIELDS_EXTRACTED,
  TEMPLATE_FIELDS_EXTRACTED_FROM_S3,
  TEMPLATE_CREATED_SUCCESSFULLY,
  TEMPLATE_RETRIEVED_SUCCESSFULLY,
  TEMPLATE_SCHEMA_RETRIEVED_SUCCESSFULLY,
  TEMPLATES_RETRIEVED_SUCCESSFULLY,
  DEPARTMENT_TEMPLATES_RETRIEVED_SUCCESSFULLY,
  TEMPLATE_UPDATED_SUCCESSFULLY,
  TEMPLATE_STATUS_UPDATED_SUCCESSFULLY,
  TEMPLATE_VERSION_CREATED_SUCCESSFULLY,
  TEMPLATE_DELETED_SUCCESSFULLY
} from './template.message'

interface PlaceholderInfo {
  type: 'field' | 'section' | 'condition' | 'inverted'
  name: string
  children?: string[]
}

@Injectable()
export class TemplateService {
  constructor(
    private readonly templateRepository: TemplateRepository,
    private readonly nodemailerService: NodemailerService,
    private readonly pdfConverterService: PdfConverterService
  ) {}
  /**
   * Parse DOCX và trích xuất placeholders
   * trả về JSON schema dựa trên các placeholders tìm thấy
   */
  async parseDocxTemplate(file: any): Promise<{
    success: boolean
    message: string
    schema: Record<string, any>
    placeholders: string[]
  }> {
    try {
      // Validate type of file
      if (!file.originalname.endsWith('.docx')) {
        throw new InvalidFileTypeError()
      }

      // load bằng pizzip
      const zip = new PizZip(file.buffer)

      // dùng docxtemplater để tách placeholders
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true
      })

      // lấy full text trong file docx đó
      const fullText = doc.getFullText()
      // console.log('Full text content:', fullText)

      // Regex để duyệt qua các placeholders
      const tags = fullText.match(/\{[^}]+\}/g) || []

      // console.log('Found tags:', tags)

      // map từng placeholder thành string, từ đó sẽ ko bị tình trạng bỏ sát placeholder hoặc các placeolder
      // trùng tên
      const placeholders: string[] = tags.map((tag) => String(tag))

      // console.log('All placeholders (in order):', placeholders)
      // console.log('Total placeholders count:', placeholders.length)

      // tạo schema
      const schema = this.buildSchemaFromPlaceholders(placeholders)

      return {
        success: true,
        message: TEMPLATE_PARSED_SUCCESSFULLY,
        schema,
        placeholders
      }
    } catch (error) {
      // Handle docxtemplater specific errors with detailed information
      if (error.properties) {
        const props = error.properties
        const explanation = props.explanation || error.message || 'Unknown template error'
        const location = props.file
          ? ` (Location: ${props.file}${props.offset ? ` at position ${props.offset}` : ''})`
          : ''
        throw new DocxParsingError(`Template parsing failed: ${explanation}${location}`)
      }

      // Handle array of errors
      if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors
          .map((err: any) => {
            const explanation = err.properties?.explanation || err.message || 'Unknown error'
            return explanation
          })
          .join('; ')
        throw new DocxParsingError(`Template parsing failed: ${errorMessages}`)
      }

      // Handle validation errors
      if (error.message && error.message.includes('Invalid file type')) {
        throw new DocxParsingError('Invalid file format. Please upload a valid DOCX file.')
      }

      // Default error handling
      throw new DocxParsingError(
        error.message || 'Failed to parse DOCX template. Please check if the file is valid and not corrupted.'
      )
    }
  }

  /**
   * Xây Json schema từ danh sách placeholders
   */
  private buildSchemaFromPlaceholders(placeholders: string[]): Record<string, any> {
    const schema: Record<string, any> = {}
    let currentSection: string | null = null
    const conditionalSections = new Set<string>()

    // process theo thứ tự
    for (let i = 0; i < placeholders.length; i++) {
      const placeholder = placeholders[i]
      const cleaned = placeholder.replace(/[{}]/g, '')

      // đối với những placeholer chứa phép toán thì bỏ qua (docxtemplater sẽ tự tính toán khi parse data)
      if (this.hasOperator(cleaned)) {
        continue
      }

      // console.log(`Processing [${i}]: ${cleaned}, Current section: ${currentSection}`)

      // nếu là bắt đầu section (#Section)
      if (cleaned.startsWith('#')) {
        const sectionName = cleaned.substring(1)
        currentSection = sectionName

        // check xem đây có phải inverted section ko (condition) bằng cách look ahead trong toàn bộ danh sách placeholders
        const hasInverted = placeholders.some((p) => p.replace(/[{}]/g, '') === `^${sectionName}`)

        if (hasInverted) {
          // xác định đây là boolean
          schema[sectionName] = false
          conditionalSections.add(sectionName)
          // console.log(`  -> Added conditional section: ${sectionName}`)
        } else {
          // nếu không thì là object
          schema[sectionName] = {}
          // console.log(`  -> Added object section: ${sectionName}`)
        }
      }
      // kết thúc section: {/name}
      else if (cleaned.startsWith('/')) {
        const sectionName = cleaned.substring(1)
        if (currentSection === sectionName) {
          currentSection = null
          // console.log(`  -> Closed section: ${sectionName}`)
        }
      }
      // Inverted section (điều kiện): {^name}
      else if (cleaned.startsWith('^')) {
        // Skip, already handled when processing section start
        // console.log(`  -> Skipped inverted section: ${cleaned}`)
        continue
      }
      // Image field: {%name}
      else if (cleaned.startsWith('%')) {
        const fieldName = cleaned.substring(1) // Remove % prefix for image fields in schema

        if (currentSection && !conditionalSections.has(currentSection)) {
          // field thuộc về section hiện tại (section object bình thường)
          schema[currentSection][fieldName] = ''
          // console.log(`  -> Added image field ${fieldName} to section ${currentSection}`)
        } else {
          // field là ở root level (hoặc ko có section hiện tại hoặc đang trong conditional section)
          schema[fieldName] = ''
          // console.log(`  -> Added root image field: ${fieldName}`)
        }
      }
      // field bình thường: {name}
      else {
        if (currentSection && !conditionalSections.has(currentSection)) {
          // field thuộc về section hiện tại (section object bình thường)
          schema[currentSection][cleaned] = ''
          // console.log(`  -> Added field ${cleaned} to section ${currentSection}`)
        } else {
          // field là ở root level (hoặc ko có section hiện tại hoặc đang trong conditional section)
          schema[cleaned] = ''
          // console.log(`  -> Added root field: ${cleaned}`)
        }
      }
    }

    return schema
  }

  /**
   * Check if a field contains mathematical operators (+, -, *, /)
   * Excludes section tags that start with #, ^, /, or %
   */
  private hasOperator(field: string): boolean {
    // Skip section tags (starting with #, ^, /, or %)
    if (field.startsWith('#') || field.startsWith('^') || field.startsWith('/') || field.startsWith('%')) {
      return false
    }
    // Check for mathematical operations
    return /[+\-*/]/.test(field)
  }

  /**
   * Helper method to parse placeholders into structured fields
   */
  private parseStructuredFields(tags: string[]): Array<{
    fieldName: string
    fieldType: string
    displayOrder: number
    parentTempId: string | null
    tempId?: string
  }> {
    // tags parameter is already passed to this method
    const fields: Array<{
      fieldName: string
      fieldType: string
      displayOrder: number
      parentTempId: string | null
      tempId?: string
    }> = []

    let displayOrder = 1
    let currentParent: string | null = null
    const processedSections = new Set<string>()
    const processedToggles = new Set<string>()
    // Track processed fields per section context to allow same field names in different sections
    const processedFieldsByContext = new Map<string, Set<string>>()

    // First pass: identify which # tags are conditions (have corresponding ^ tags)
    const conditionNames = new Set<string>()
    for (const tag of tags) {
      const cleaned = tag.replace(/[{}]/g, '')
      if (cleaned.startsWith('^')) {
        const conditionName = cleaned.substring(1)
        conditionNames.add(conditionName)
      }
    }

    // Second pass: process tags in order as they appear in the document
    for (const tag of tags) {
      const cleaned = tag.replace(/[{}]/g, '')

      // Skip operators
      if (this.hasOperator(cleaned)) {
        continue
      }

      // Handle section start tags (#sectionName)
      if (cleaned.startsWith('#')) {
        const sectionName = cleaned.substring(1)

        // Check if this is a condition (has corresponding ^ tag)
        if (conditionNames.has(sectionName)) {
          // This is a condition, skip it - we'll handle it when we encounter the ^ tag
          continue
        } else {
          // This is a regular PART section
          if (!processedSections.has(sectionName)) {
            const tempId = `${sectionName}-parent`
            fields.push({
              fieldName: sectionName,
              fieldType: 'PART',
              displayOrder: displayOrder++,
              parentTempId: null,
              tempId: tempId
            })
            currentParent = tempId
            processedSections.add(sectionName)
            // Initialize field tracking for this section
            processedFieldsByContext.set(tempId, new Set<string>())
          } else {
            // If section already exists, just set current parent
            currentParent = `${sectionName}-parent`
          }
        }
        continue
      }

      // Handle section end tags {/sectionName}
      if (cleaned.startsWith('/')) {
        const endingSectionName = cleaned.substring(1)
        // Only reset currentParent if we're ending the current section
        if (currentParent && currentParent === `${endingSectionName}-parent`) {
          currentParent = null
        }
        continue
      }

      // Handle inverted sections {^sectionName} - indicates toggle/condition
      if (cleaned.startsWith('^')) {
        const sectionName = cleaned.substring(1)

        if (!processedToggles.has(sectionName)) {
          fields.push({
            fieldName: sectionName,
            fieldType: 'TOGGLE',
            displayOrder: displayOrder++,
            parentTempId: currentParent
          })
          processedToggles.add(sectionName)
        }
        continue
      }

      // Handle image fields {%fieldName}
      if (cleaned.startsWith('%')) {
        const fieldName = cleaned.substring(1) // Remove % prefix for image fields
        const contextKey = currentParent || 'global'
        const contextFields = processedFieldsByContext.get(contextKey) || new Set<string>()

        if (!contextFields.has(cleaned)) {
          fields.push({
            fieldName: fieldName,
            fieldType: 'IMAGE',
            displayOrder: displayOrder++,
            parentTempId: currentParent
          })
          contextFields.add(cleaned)
          processedFieldsByContext.set(contextKey, contextFields)
        }
        continue
      }

      // Regular fields - allow same field names in different sections
      const contextKey = currentParent || 'global'
      const contextFields = processedFieldsByContext.get(contextKey) || new Set<string>()

      if (!contextFields.has(cleaned)) {
        fields.push({
          fieldName: cleaned,
          fieldType: 'TEXT',
          displayOrder: displayOrder++,
          parentTempId: currentParent
        })
        contextFields.add(cleaned)
        processedFieldsByContext.set(contextKey, contextFields)
      }
    }

    return fields
  }

  /**
   * Parse DOCX and extract structured fields for create template format
   * Returns fields in the same structure as create template API
   */
  async extractFieldsFromDocx(file: any): Promise<{
    success: boolean
    message: string
    fields: Array<{
      fieldName: string
      fieldType: string
      displayOrder: number
      parentTempId: string | null
      tempId?: string
    }>
    totalFields: number
  }> {
    try {
      // Validate file type
      if (!file.originalname.endsWith('.docx')) {
        throw new InvalidFileTypeError()
      }

      // Load file with pizzip
      const zip = new PizZip(file.buffer)

      // Use docxtemplater to extract placeholders
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true
      })

      // Get full text from the DOCX file
      const fullText = doc.getFullText()

      // Extract all placeholders using regex
      const tags = fullText.match(/\{[^}]+\}/g) || []

      // Use the structured field parser
      const structuredFields = this.parseStructuredFields(tags)

      return {
        success: true,
        message: TEMPLATE_FIELDS_EXTRACTED(structuredFields.length),
        fields: structuredFields,
        totalFields: structuredFields.length
      }
    } catch (error) {
      // Handle docxtemplater specific errors with detailed information
      if (error.properties) {
        const props = error.properties
        const explanation = props.explanation || error.message || 'Unknown template error'
        const location = props.file
          ? ` (Location: ${props.file}${props.offset ? ` at position ${props.offset}` : ''})`
          : ''
        throw new DocxParsingError(`Field extraction failed: ${explanation}${location}`)
      }

      // Handle array of errors
      if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors
          .map((err: any) => {
            const explanation = err.properties?.explanation || err.message || 'Unknown error'
            return explanation
          })
          .join('; ')
        throw new DocxParsingError(`Field extraction failed: ${errorMessages}`)
      }

      // Default error handling
      throw new DocxParsingError(
        error.message || 'Failed to extract fields from DOCX. Please check if the template format is correct.'
      )
    }
  }

  /**
   * Extract field names from DOCX file hosted on S3
   * Downloads the file from S3 URL and processes it similar to extractFieldsFromDocx
   */
  async extractFieldsFromS3Url(s3Url: string): Promise<{
    success: boolean
    message: string
    fields: Array<{
      fieldName: string
      fieldType: string
      displayOrder: number
      parentTempId: string | null
      tempId?: string
    }>
    totalFields: number
  }> {
    try {
      // Download file from S3 URL
      const response = await fetch(s3Url)

      if (!response.ok) {
        throw new S3DownloadError(response.status, response.statusText)
      }

      // Get the buffer from the response
      const buffer = await response.arrayBuffer()
      const fileBuffer = Buffer.from(buffer)

      // Load file with pizzip
      const zip = new PizZip(fileBuffer)

      // Use docxtemplater to extract placeholders
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true
      })

      // Get full text from the DOCX file
      const fullText = doc.getFullText()

      // Extract all placeholders using regex
      const tags = fullText.match(/\{[^}]+\}/g) || []

      // Use the structured field parser
      const structuredFields = this.parseStructuredFields(tags)

      return {
        success: true,
        message: TEMPLATE_FIELDS_EXTRACTED_FROM_S3(structuredFields.length),
        fields: structuredFields,
        totalFields: structuredFields.length
      }
    } catch (error) {
      // Handle fetch errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new S3FetchError(error.message)
      }

      // Handle docxtemplater specific errors with detailed information
      if (error.properties) {
        const props = error.properties
        const explanation = props.explanation || error.message || 'Unknown template error'
        const location = props.file
          ? ` (Location: ${props.file}${props.offset ? ` at position ${props.offset}` : ''})`
          : ''
        throw new S3DocxParsingError(`S3 template parsing failed: ${explanation}${location}`)
      }

      // Handle array of errors
      if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors
          .map((err: any) => {
            const explanation = err.properties?.explanation || err.message || 'Unknown error'
            return explanation
          })
          .join('; ')
        throw new S3DocxParsingError(`S3 template parsing failed: ${errorMessages}`)
      }

      // Handle other errors
      throw new S3ExtractionError(error.message || 'Failed to extract fields from S3 template')
    }
  }

  /**
   * Create a complete template with sections and fields
   * Role validation is handled by RBAC guards
   */
  async createTemplate(
    templateData: CreateTemplateFormDto,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ) {
    // Validate required fields
    if (!templateData.templateConfig) {
      throw new TemplateConfigRequiredError()
    }

    // Validate department exists
    const departmentExists = await this.templateRepository.validateDepartmentExists(templateData.departmentId)
    if (!departmentExists) {
      throw new DepartmentNotFoundError(templateData.departmentId)
    }

    // Check if template name already exists
    const nameExists = await this.templateRepository.templateNameExists(templateData.name)
    if (nameExists) {
      throw new TemplateNameAlreadyExistsError(templateData.name)
    }

    try {
      // Validate that any field-level role requirement (roleRequired) matches the section's editBy
      for (const section of templateData.sections) {
        if (!section.fields || !Array.isArray(section.fields)) continue
        for (const field of section.fields) {
          // Only validate when roleRequired is explicitly provided
          if (field.roleRequired !== undefined && field.roleRequired !== null) {
            // Compare values directly (do not hardcode 'TRAINER' or 'TRAINEE')
            if (String(field.roleRequired) !== String(section.editBy)) {
              throw new RoleRequiredMismatchError(
                field.fieldName,
                section.label,
                String(field.roleRequired),
                String(section.editBy)
              )
            }
          }

          // Validate that signature fields must have roleRequired set
          if (field.fieldType === 'SIGNATURE_DRAW' || field.fieldType === 'SIGNATURE_IMG') {
            if (!field.roleRequired) {
              throw new SignatureFieldMissingRoleError(field.fieldName, section.label)
            }
          }
        }
      }

      // Set default status to DRAFT if not provided
      const status = templateData.status || 'DRAFT'
      const templateDataWithStatus = {
        ...templateData,
        status
      } as CreateTemplateFormDto & { status: 'DRAFT' | 'PENDING' }

      // Preprocess FINAL_SCORE_TEXT options before validation and schema generation
      const processedSections = this.preprocessFinalScoreTextOptions(templateData.sections)
      const templateDataWithProcessedSections = {
        ...templateDataWithStatus,
        sections: processedSections
      }

      // Validate business rules only if status is PENDING
      if (status === 'PENDING') {
        this.validateTemplateBusinessRules(processedSections)
      }

      // Generate nested template schema from processed sections and fields
      const templateSchema = this.generateNestedSchemaFromSections(processedSections)

      // Create template with all nested data
      // Use alternative method for large templates if needed
      const result = await this.templateRepository.createTemplateWithSectionsAndFields(
        templateDataWithProcessedSections,
        userContext.userId,
        templateSchema
      )

      return {
        success: true,
        data: result,
        message: TEMPLATE_CREATED_SUCCESSFULLY
      }
    } catch (error) {
      console.error('Template creation error:', error)

      // Re-throw known custom errors as-is
      if (
        error instanceof TemplateConfigRequiredError ||
        error instanceof DepartmentNotFoundError ||
        error instanceof TemplateNameAlreadyExistsError ||
        error instanceof RoleRequiredMismatchError ||
        error instanceof SignatureFieldMissingRoleError ||
        error instanceof PartFieldMissingChildrenError ||
        error instanceof ToggleDependentSectionMissingControlError ||
        error instanceof ValueListFieldMissingOptionsError ||
        error instanceof ValueListFieldInvalidOptionsError ||
        error instanceof MissingSignatureFieldError ||
        error instanceof MissingSubmittableSectionError ||
        error instanceof MissingFinalScoreFieldsError ||
        error instanceof DuplicateFinalScoreFieldsError ||
        error instanceof InvalidFieldTypeError ||
        error instanceof DuplicateFieldNameError ||
        error instanceof InvalidReferenceError
      ) {
        throw error
      }

      // Handle Prisma validation errors more gracefully
      if (error.message && error.message.includes('Invalid value for argument')) {
        // Extract field type validation errors
        const fieldTypeMatch = error.message.match(/fieldType.*Expected ([^.]+)/)
        if (fieldTypeMatch) {
          throw new InvalidFieldTypeError()
        }
      }

      // Handle unique constraint violations
      if (error.message && error.message.includes('Unique constraint failed')) {
        if (error.message.includes('sectionId') && error.message.includes('fieldName')) {
          throw new DuplicateFieldNameError()
        }
      }

      // Handle other specific errors
      if (error.message && error.message.includes('Foreign key constraint failed')) {
        throw new InvalidReferenceError()
      }

      // Default error handling
      throw new TemplateCreationFailedError(error.message || 'An unexpected error occurred while creating the template')
    }
  }

  /**
   * Get template by ID with full details
   */
  async getTemplateById(id: string) {
    const template = await this.templateRepository.findTemplateById(id)

    if (!template) {
      throw new TemplateNotFoundError()
    }

    return {
      success: true,
      data: template,
      message: TEMPLATE_RETRIEVED_SUCCESSFULLY
    }
  }

  /**
   * Get template schema by ID - Returns template in the same format as create template API
   * This is useful for editing/cloning templates
   */
  async getTemplateSchemaById(id: string) {
    const template = await this.templateRepository.findTemplateById(id)

    if (!template) {
      throw new TemplateNotFoundError()
    }

    // Transform the template data to match the create template format for FE editing
    const templateStructure = {
      name: template.name,
      description: template.description,
      departmentId: template.departmentId,
      templateContent: template.templateContent,
      sections: template.sections.map((section) => ({
        id: section.id,
        label: section.label,
        displayOrder: section.displayOrder,
        editBy: section.editBy,
        roleInSubject: section.roleInSubject,
        isSubmittable: section.isSubmittable,
        isToggleDependent: section.isToggleDependent,
        fields: section.fields
          .filter((field) => !field.parentId) // Get only parent fields first
          .map((field) => this.buildFieldWithChildren(field, section.fields))
      }))
    }

    return {
      success: true,
      // data: templateStructure, // Complete structure for FE editing
      schema: template.templateSchema, // Raw templateSchema for form rendering
      metadata: {
        templateId: template.id,
        version: template.version,
        status: template.status,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        department: template.department,
        createdByUser: template.createdByUser
      },
      message: TEMPLATE_SCHEMA_RETRIEVED_SUCCESSFULLY
    }
  }

  /**
   * Helper method to build field with its children hierarchy
   */
  private buildFieldWithChildren(field: any, allFields: any[]): any {
    const fieldData = {
      label: field.label,
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      roleRequired: field.roleRequired,
      options: field.options,
      displayOrder: field.displayOrder,
      ...(field.parentId && { parentTempId: `field_${field.parent?.fieldName}` })
    }

    return fieldData
  }

  /**
   * Build nested schema structure from sections and fields
   * Uses parent-child relationships to create nested objects
   */
  private buildNestedSchema(sections: any[]): Record<string, any> {
    const schema: Record<string, any> = {}

    // Process each section
    for (const section of sections) {
      // Process each field in the section
      for (const field of section.fields) {
        // If field has a parent, it's a child field
        if (field.parentId) {
          // Find the parent field
          const parentField = section.fields.find((f: any) => f.id === field.parentId)

          if (parentField) {
            const parentFieldName = parentField.fieldName

            // Initialize parent object if not exists
            if (!schema[parentFieldName]) {
              schema[parentFieldName] = {}
            }

            // Add child field to parent object
            schema[parentFieldName][field.fieldName] = this.getDefaultValueForField(field)
          }
        } else {
          // Top-level field (no parent)
          // Check if this field has children
          const hasChildren = section.fields.some((f: any) => f.parentId === field.id)

          if (hasChildren) {
            // Initialize as object to hold children
            if (!schema[field.fieldName]) {
              schema[field.fieldName] = {}
            }
          } else {
            // Simple field with no children
            schema[field.fieldName] = this.getDefaultValueForField(field)
          }
        }
      }
    }

    return schema
  }

  /**
   * Get default value for a field based on its type
   */
  private getDefaultValueForField(field: any): any {
    switch (field.fieldType) {
      case 'TOGGLE':
      case 'SECTION_CONTROL_TOGGLE':
        return false
      case 'NUMBER':
      case 'FINAL_SCORE_NUM':
        return 0
      case 'CHECK_BOX':
        return {} // CHECK_BOX is a parent field that contains child fields
      default:
        return ''
    }
  }

  /**
   * Get all templates with optional status filtering
   */
  async getAllTemplates(status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED') {
    const templates = await this.templateRepository.findAllTemplates(status)

    return {
      success: true,
      data: templates,
      message: TEMPLATES_RETRIEVED_SUCCESSFULLY
    }
  }

  /**
   * Get templates by department with optional status filtering
   */
  async getTemplatesByDepartment(departmentId: string, status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED') {
    const templates = await this.templateRepository.findTemplatesByDepartment(departmentId, status)

    return {
      success: true,
      data: templates,
      message: DEPARTMENT_TEMPLATES_RETRIEVED_SUCCESSFULLY
    }
  }

  /**
   * Get templates created by a specific user with optional status filtering
   */
  async getTemplatesByUser(userId: string, status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED' | 'DRAFT') {
    const templates = await this.templateRepository.findTemplatesByUser(userId, status)

    return {
      success: true,
      data: templates,
      message: TEMPLATES_RETRIEVED_SUCCESSFULLY
    }
  }

  /**
   * Change template status
   * - Disable: PUBLISHED/REJECTED → DISABLED (with assessment usage check)
   * - Enable: DISABLED → PENDING
   */
  async changeTemplateStatus(
    templateId: string,
    newStatus: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED',
    userContext: { userId: string; roleName: string; departmentId?: string }
  ) {
    // Check if template exists
    const existingTemplate = await this.templateRepository.findTemplateById(templateId)
    if (!existingTemplate) {
      throw new TemplateNotFoundError()
    }

    const currentStatus = existingTemplate.status

    // Validate status transitions
    if (currentStatus === 'DRAFT' || currentStatus === 'PENDING') {
      throw new InvalidStatusTransitionError(currentStatus, newStatus)
    }

    // Define allowed transitions
    const allowedTransitions: Record<string, string[]> = {
      PUBLISHED: ['DISABLED'], // Published can be disabled
      REJECTED: ['DISABLED'], // Rejected can be disabled
      DISABLED: ['PENDING'] // Disabled can be enabled (moved to PENDING for review)
    }

    // Check if the transition is allowed
    if (!allowedTransitions[currentStatus] || !allowedTransitions[currentStatus].includes(newStatus)) {
      throw new InvalidStatusTransitionError(currentStatus, newStatus)
    }

    // If disabling template (PUBLISHED/REJECTED → DISABLED), check assessment usage
    if ((currentStatus === 'PUBLISHED' || currentStatus === 'REJECTED') && newStatus === 'DISABLED') {
      const hasActiveAssessments = await this.templateRepository.templateHasActiveAssessments(templateId)
      if (hasActiveAssessments) {
        throw new TemplateInUseCannotDisableError()
      }
    }

    // Update template status
    const updatedTemplate = await this.templateRepository.updateTemplateStatus(
      templateId,
      newStatus,
      userContext.userId,
      false // This is not a review action
    )

    return {
      success: true,
      data: updatedTemplate,
      message: TEMPLATE_STATUS_UPDATED_SUCCESSFULLY(newStatus)
    }
  }

  /**
   * Review template - approve or reject a PENDING template with email notification
   */
  async reviewTemplate(
    templateId: string,
    body: ReviewTemplateBodyType,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ): Promise<ReviewTemplateResType> {
    try {
      // Check if template exists and is in PENDING status
      const existingTemplate = await this.templateRepository.findTemplateById(templateId)
      if (!existingTemplate) {
        throw new TemplateNotFoundError()
      }

      if (existingTemplate.status !== 'PENDING') {
        throw new Error('Template must be in PENDING status to be reviewed')
      }

      // Get template creator details for email notification
      const templateWithCreator = await this.templateRepository.getTemplateWithCreator(templateId)
      if (!templateWithCreator) {
        throw new TemplateNotFoundError()
      }

      // Get reviewer details
      const reviewerInfo = await this.templateRepository.getUserById(userContext.userId)
      if (!reviewerInfo) {
        throw new Error('Reviewer information not found')
      }

      // Get department info
      const departmentInfo = templateWithCreator.department
      const departmentName = departmentInfo?.name || 'Unknown Department'

      // Update template status
      const updatedTemplate = await this.templateRepository.updateTemplateStatus(
        templateId,
        body.action,
        userContext.userId,
        true // isReviewAction
      )

      // Prepare email notification
      const creatorName =
        `${templateWithCreator.createdByUser.firstName} ${templateWithCreator.createdByUser.lastName}`.trim()
      const reviewerName = `${reviewerInfo.firstName} ${reviewerInfo.lastName}`.trim()
      const creationDate = new Date(templateWithCreator.createdAt).toLocaleDateString()
      const reviewDate = new Date().toLocaleDateString()

      // Send email notification
      let emailSent = false
      try {
        if (body.action === 'PUBLISHED') {
          const emailResult = await this.nodemailerService.sendApprovedTemplateEmail(
            templateWithCreator.createdByUser.email,
            creatorName,
            templateWithCreator.name,
            templateWithCreator.version,
            departmentName,
            creationDate,
            reviewerName,
            reviewDate
          )
          emailSent = emailResult.success
        } else if (body.action === 'REJECTED') {
          const emailResult = await this.nodemailerService.sendRejectedTemplateEmail(
            templateWithCreator.createdByUser.email,
            creatorName,
            templateWithCreator.name,
            templateWithCreator.version,
            departmentName,
            creationDate,
            reviewerName,
            reviewDate,
            body.comment || 'No specific comment provided'
          )
          emailSent = emailResult.success
        }
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError)
        // Don't fail the entire operation if email fails
      }

      return {
        success: true,
        message: `Template ${body.action.toLowerCase()} successfully${emailSent ? ' and notification email sent' : ''}`,
        data: {
          templateId: updatedTemplate.id,
          templateName: updatedTemplate.name,
          status: body.action,
          previousStatus: 'PENDING',
          reviewedBy: userContext.userId,
          reviewedAt: new Date(),
          comment: body.comment || null,
          emailSent
        }
      }
    } catch (error) {
      console.error('Template review failed:', error)

      if (error instanceof TemplateNotFoundError) {
        throw error
      }

      if (error.message?.includes('PENDING status')) {
        throw new Error('Template must be in PENDING status to be reviewed')
      }

      throw new Error(`Failed to review template: ${error.message}`)
    }
  }

  /**
   * Update a REJECTED template with new content
   * Recreates the template while preserving original metadata
   * Only works on templates with REJECTED status
   */
  async updateRejectedTemplate(
    templateId: string,
    templateData: CreateTemplateFormDto,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ) {
    // Check if template exists and is REJECTED
    const existingTemplate = await this.templateRepository.findTemplateById(templateId)
    if (!existingTemplate) {
      throw new TemplateNotFoundError()
    }

    if (existingTemplate.status !== 'REJECTED') {
      throw new InvalidTemplateStatusForUpdateError(existingTemplate.status)
    }

    // Validate required fields
    if (!templateData.templateConfig) {
      throw new TemplateConfigRequiredError()
    }

    // Validate department exists
    const departmentExists = await this.templateRepository.validateDepartmentExists(templateData.departmentId)
    if (!departmentExists) {
      throw new DepartmentNotFoundError(templateData.departmentId)
    }

    // Check if template name already exists (excluding current template)
    const nameExists = await this.templateRepository.templateNameExists(templateData.name, templateId)
    if (nameExists) {
      throw new TemplateNameAlreadyExistsError(templateData.name)
    }

    try {
      // Validate field relationships (same as create template)
      for (const section of templateData.sections) {
        if (!section.fields || !Array.isArray(section.fields)) continue
        for (const field of section.fields) {
          // Only validate when roleRequired is explicitly provided
          if (field.roleRequired !== undefined && field.roleRequired !== null) {
            if (String(field.roleRequired) !== String(section.editBy)) {
              throw new RoleRequiredMismatchError(
                field.fieldName,
                section.label,
                String(field.roleRequired),
                String(section.editBy)
              )
            }
          }

          // Validate that signature fields must have roleRequired set
          if (field.fieldType === 'SIGNATURE_DRAW' || field.fieldType === 'SIGNATURE_IMG') {
            if (!field.roleRequired) {
              throw new SignatureFieldMissingRoleError(field.fieldName, section.label)
            }
          }

          // CHECK_BOX field validation handled in validateTemplateBusinessRules
          // PART field validation handled in validateTemplateBusinessRules
        }
      }

      // Preprocess FINAL_SCORE_TEXT options before validation and schema generation
      const processedSections = this.preprocessFinalScoreTextOptions(templateData.sections)
      const templateDataWithProcessedSections = {
        ...templateData,
        sections: processedSections
      }

      // Validate business rules - updated template status will be changed to PENDING
      this.validateTemplateBusinessRules(processedSections)

      // Generate nested template schema from processed sections and fields
      const templateSchema = this.generateNestedSchemaFromSections(processedSections)

      // Update rejected template (recreate with preserved metadata)
      const result = await this.templateRepository.updateRejectedTemplate(
        templateId,
        templateDataWithProcessedSections,
        userContext.userId,
        templateSchema
      )

      return {
        success: true,
        data: result,
        message: 'Rejected template updated successfully and status changed to PENDING'
      }
    } catch (error) {
      throw new TemplateCreationFailedError(error.message)
    }
  }

  /**
   * Update a DRAFT template with new content
   * Recreates the template while preserving original metadata
   * Only works on templates with DRAFT status
   */
  async updateDraftTemplate(
    templateId: string,
    templateData: CreateTemplateFormDto,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ) {
    // Check if template exists and is DRAFT
    const existingTemplate = await this.templateRepository.findTemplateById(templateId)
    if (!existingTemplate) {
      throw new TemplateNotFoundError()
    }

    if (existingTemplate.status !== 'DRAFT') {
      throw new InvalidDraftTemplateStatusError(existingTemplate.status)
    }

    // Validate required fields
    if (!templateData.templateConfig) {
      throw new TemplateConfigRequiredError()
    }

    // Validate department exists
    const departmentExists = await this.templateRepository.validateDepartmentExists(templateData.departmentId)
    if (!departmentExists) {
      throw new DepartmentNotFoundError(templateData.departmentId)
    }

    // Check if template name already exists (excluding current template)
    const nameExists = await this.templateRepository.templateNameExists(templateData.name, templateId)
    if (nameExists) {
      throw new TemplateNameAlreadyExistsError(templateData.name)
    }

    try {
      // Validate field relationships (same as create template)
      for (const section of templateData.sections) {
        if (!section.fields || !Array.isArray(section.fields)) continue
        for (const field of section.fields) {
          // Only validate when roleRequired is explicitly provided
          if (field.roleRequired !== undefined && field.roleRequired !== null) {
            if (String(field.roleRequired) !== String(section.editBy)) {
              throw new RoleRequiredMismatchError(
                field.fieldName,
                section.label,
                String(field.roleRequired),
                String(section.editBy)
              )
            }
          }

          // Validate that signature fields must have roleRequired set
          if (field.fieldType === 'SIGNATURE_DRAW' || field.fieldType === 'SIGNATURE_IMG') {
            if (!field.roleRequired) {
              throw new SignatureFieldMissingRoleError(field.fieldName, section.label)
            }
          }
        }
      }

      // Set default status to DRAFT if not provided
      const status = templateData.status || 'DRAFT'
      const templateDataWithStatus = {
        ...templateData,
        status
      } as CreateTemplateFormDto & { status: 'DRAFT' | 'PENDING' }

      // Preprocess FINAL_SCORE_TEXT options before validation and schema generation
      const processedSections = this.preprocessFinalScoreTextOptions(templateData.sections)
      const templateDataWithProcessedSections = {
        ...templateDataWithStatus,
        sections: processedSections
      }

      // Validate business rules only if status is PENDING
      if (status === 'PENDING') {
        this.validateTemplateBusinessRules(processedSections)
      }

      // Generate nested template schema from processed sections and fields
      const templateSchema = this.generateNestedSchemaFromSections(processedSections)

      // Update draft template (recreate with preserved metadata)
      const result = await this.templateRepository.updateDraftTemplate(
        templateId,
        templateDataWithProcessedSections,
        userContext.userId,
        templateSchema
      )

      return {
        success: true,
        data: result,
        message: `Draft template updated successfully and status changed to ${status}`
      }
    } catch (error) {
      throw new TemplateCreationFailedError(error.message)
    }
  }

  /**
   * Update template basic information (name, description, departmentId)
   */
  async updateTemplateForm(
    templateId: string,
    updateData: UpdateTemplateFormDto,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ) {
    // Check if template exists
    const existingTemplate = await this.templateRepository.findTemplateById(templateId)
    if (!existingTemplate) {
      throw new TemplateNotFoundError()
    }

    // Check if name is being updated and if it's unique
    if (updateData.name && updateData.name !== existingTemplate.name) {
      const nameExists = await this.templateRepository.templateNameExists(updateData.name, templateId)
      if (nameExists) {
        throw new TemplateNameAlreadyExistsError(updateData.name)
      }
    }

    // If trying to change department, check if template has been used in assessments
    if (updateData.departmentId && updateData.departmentId !== existingTemplate.departmentId) {
      const hasAssessments = await this.templateRepository.templateHasAssessments(templateId)
      if (hasAssessments) {
        throw new TemplateHasAssessmentsError()
      }
    }

    // If departmentId is being updated, validate that the new department exists
    if (updateData.departmentId) {
      const departmentExists = await this.templateRepository.validateDepartmentExists(updateData.departmentId)
      if (!departmentExists) {
        throw new DepartmentNotFoundError(updateData.departmentId)
      }
    }

    // Update template
    const updatedTemplate = await this.templateRepository.updateTemplateBasicInfo(
      templateId,
      updateData,
      userContext.userId
    )

    return {
      success: true,
      data: updatedTemplate,
      message: TEMPLATE_UPDATED_SUCCESSFULLY
    }
  }

  /**
   * Generate nested schema based on field hierarchy (parent-child relationships)
   * Fields are ordered by displayOrder within each section
   * Note: This method should be called BEFORE field name processing to maintain original nested structure
   */
  private generateNestedSchemaFromSections(sections: any[]): Record<string, any> {
    const schema: Record<string, any> = {}

    // Sort sections by displayOrder first
    const sortedSections = [...sections].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))

    sortedSections.forEach((section) => {
      // Sort fields by displayOrder within each section
      const sortedFields = [...section.fields].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))

      // Build field maps for parent-child relationships using original field names
      const fieldByTempId = new Map<string, any>()
      const fieldByName = new Map<string, any>()
      const rootFields: any[] = []

      // First pass: create field maps and identify parent fields
      sortedFields.forEach((field: any) => {
        // For schema generation, use original field names (without prefix processing)
        let originalFieldName = field.fieldName

        // If this field has a parent, use the original base name for schema structure
        if (field.parentTempId) {
          // Extract the base field name if it's been processed (remove parent prefix)
          const parentField = section.fields.find((f: any) => f.tempId === field.parentTempId)
          if (parentField && field.fieldName.startsWith(`${parentField.fieldName}_`)) {
            originalFieldName = field.fieldName.replace(`${parentField.fieldName}_`, '')
          }
        }

        const fieldObj = {
          name: originalFieldName,
          tempId: field.tempId,
          parentTempId: field.parentTempId,
          type: this.getSchemaTypeFromFieldType(field.fieldType),
          displayOrder: field.displayOrder || 0,
          children: [] as any[]
        }

        // Map by both tempId (if exists) and original field name
        if (field.tempId) {
          fieldByTempId.set(field.tempId, fieldObj)
        }
        fieldByName.set(originalFieldName, fieldObj)

        // If no parent, it's a root field
        if (!field.parentTempId) {
          rootFields.push(fieldObj)
        }
      })

      // Second pass: build parent-child relationships using tempId references
      sortedFields.forEach((field: any) => {
        if (field.parentTempId) {
          const parentField = fieldByTempId.get(field.parentTempId)

          // Get original field name for schema
          let originalFieldName = field.fieldName
          if (parentField && field.fieldName.startsWith(`${parentField.name}_`)) {
            originalFieldName = field.fieldName.replace(`${parentField.name}_`, '')
          }

          const currentField = fieldByName.get(originalFieldName)

          if (parentField && currentField) {
            parentField.children.push(currentField)
          }
        }
      })

      // Sort root fields by displayOrder
      rootFields.sort((a, b) => a.displayOrder - b.displayOrder)

      // Build nested schema structure
      this.buildNestedSchemaFromFields(rootFields, schema)
    })

    return schema
  }

  /**
   * Recursively build nested schema structure from field hierarchy
   * Children are also sorted by displayOrder
   */
  private buildNestedSchemaFromFields(fields: any[], target: Record<string, any>): void {
    fields.forEach((field) => {
      if (field.children && field.children.length > 0) {
        // Sort children by displayOrder before processing
        const sortedChildren = [...field.children].sort((a, b) => a.displayOrder - b.displayOrder)

        // This field has children - create an object
        // For PART type fields, use the field name as the object key
        if (field.type === 'part') {
          target[field.name] = {}
          this.buildNestedSchemaFromFields(sortedChildren, target[field.name])
        } else {
          // Non-part field with children (shouldn't happen but handle anyway)
          target[field.name] = {}
          this.buildNestedSchemaFromFields(sortedChildren, target[field.name])
        }
      } else {
        // Leaf field - set default value based on type
        // Skip PART type fields without children
        if (field.type !== 'part') {
          target[field.name] = this.getDefaultValueForType(field.type)
        }
      }
    })
  }

  /**
   * Get schema type from FieldType enum
   */
  private getSchemaTypeFromFieldType(fieldType: string): string {
    switch (fieldType) {
      case 'TOGGLE':
      case 'SECTION_CONTROL_TOGGLE':
        return 'boolean'
      case 'NUMBER':
      case 'FINAL_SCORE_NUM':
        return 'number'
      case 'PART':
      case 'CHECK_BOX':
        return 'part' // Special type for parent/section fields
      case 'TEXT':
      case 'IMAGE':
      case 'SIGNATURE_DRAW':
      case 'SIGNATURE_IMG':
      case 'VALUE_LIST':
      default:
        return 'string'
    }
  }

  /**
   * Get default value for schema type
   */
  private getDefaultValueForType(type: string): any {
    switch (type) {
      case 'boolean':
        return false
      case 'number':
        return 0
      case 'string':
      default:
        return ''
    }
  }

  /**
   * Create a new version of an existing template
   */
  async createTemplateVersion(
    templateVersionData: CreateTemplateVersionDto,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ) {
    // Check if original template exists
    const originalTemplate = await this.templateRepository.findTemplateById(templateVersionData.originalTemplateId)
    if (!originalTemplate) {
      throw new OriginalTemplateNotFoundError()
    }

    // Validate that any field-level role requirement (roleRequired) matches the section's editBy
    for (const section of templateVersionData.sections) {
      if (!section.fields || !Array.isArray(section.fields)) continue
      for (const field of section.fields) {
        // Only validate when roleRequired is explicitly provided
        if (field.roleRequired !== undefined && field.roleRequired !== null) {
          // Compare values directly
          if (String(field.roleRequired) !== String(section.editBy)) {
            throw new RoleRequiredMismatchError(
              field.fieldName,
              section.label,
              String(field.roleRequired),
              String(section.editBy)
            )
          }
        }

        // Validate that signature fields must have roleRequired set
        if (field.fieldType === 'SIGNATURE_DRAW' || field.fieldType === 'SIGNATURE_IMG') {
          if (!field.roleRequired) {
            throw new SignatureFieldMissingRoleError(field.fieldName, section.label)
          }
        }
      }
    }

    // Set default status to DRAFT if not provided
    const status = templateVersionData.status || 'DRAFT'

    // Preprocess FINAL_SCORE_TEXT options before validation and schema generation
    const processedSections = this.preprocessFinalScoreTextOptions(templateVersionData.sections)

    // Validate business rules only if status is PENDING
    if (status === 'PENDING') {
      this.validateTemplateBusinessRules(processedSections)
    }

    // Generate appropriate name for the new version
    let finalTemplateName = templateVersionData.name

    // Check if template name already exists
    const nameExists = await this.templateRepository.templateNameExists(templateVersionData.name)
    if (nameExists) {
      // Get the version number that will be assigned to automatically generate versioned name
      // First determine the first version ID for this template group
      const firstVersionId = originalTemplate.referFirstVersionId || templateVersionData.originalTemplateId

      // Get max version and calculate new version number
      const maxVersion = await this.templateRepository.getMaxVersionForTemplate(firstVersionId)
      const newVersion = maxVersion + 1

      // Append version suffix to the name
      finalTemplateName = `${templateVersionData.name} v.${newVersion}`
    }

    try {
      // Generate nested template schema from processed sections and fields
      const templateSchema = this.generateNestedSchemaFromSections(processedSections)

      // Create new template version with all nested data
      const result = await this.templateRepository.createTemplateVersion(
        templateVersionData.originalTemplateId,
        {
          name: finalTemplateName,
          description: templateVersionData.description,
          templateContent: templateVersionData.templateContent,
          templateConfig: templateVersionData.templateConfig,
          sections: processedSections,
          status: status
        },
        userContext.userId,
        templateSchema
      )

      return {
        success: true,
        data: result,
        message: TEMPLATE_VERSION_CREATED_SUCCESSFULLY
      }
    } catch (error) {
      throw new TemplateVersionCreationError(error.message)
    }
  }

  /**
   * Generate basic schema from field names (legacy method)
   */
  private generateSchemaFromFieldNames(fieldNames: string[]): Record<string, any> {
    const schema: Record<string, any> = {}

    fieldNames.forEach((fieldName) => {
      // Remove curly braces if present and clean field name
      const cleanName = fieldName.replace(/[{}]/g, '').trim()

      schema[cleanName] = {
        type: 'string',
        required: false,
        description: `Field: ${cleanName}`
      }
    })

    return {
      type: 'object',
      properties: schema,
      additionalProperties: false
    }
  }

  /**
   * Get template PDF from template_content S3 URL
   */
  async getTemplatePdf(templateFormId: string): Promise<Buffer> {
    try {
      // Get template form from database
      const templateForm = await this.templateRepository.findTemplateById(templateFormId)
      if (!templateForm) {
        throw new TemplateNotFoundError()
      }

      if (!templateForm.templateContent) {
        throw new Error('Template content URL not found')
      }

      // Convert DOCX to PDF using the shared service
      const pdfBuffer = await this.pdfConverterService.convertDocxToPdfFromS3(templateForm.templateContent)
      return pdfBuffer
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        throw error
      }
      throw new Error(`Failed to generate template PDF: ${error.message}`)
    }
  }

  /**
   * Get template config PDF from template_config S3 URL
   */
  async getTemplateConfigPdf(templateFormId: string): Promise<Buffer> {
    try {
      // Get template form from database
      const templateForm = await this.templateRepository.findTemplateById(templateFormId)
      if (!templateForm) {
        throw new TemplateNotFoundError()
      }

      if (!templateForm.templateConfig) {
        throw new Error('Template config URL not found')
      }

      // Convert DOCX to PDF using the shared service
      const pdfBuffer = await this.pdfConverterService.convertDocxToPdfFromS3(templateForm.templateConfig)
      return pdfBuffer
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        throw error
      }
      throw new Error(`Failed to generate template config PDF: ${error.message}`)
    }
  }

  /**
   * Get both template and config PDFs as a ZIP file
   */
  async getTemplateBothPdf(templateFormId: string): Promise<Buffer> {
    try {
      // Get template form from database
      const templateForm = await this.templateRepository.findTemplateById(templateFormId)
      if (!templateForm) {
        throw new TemplateNotFoundError()
      }

      if (!templateForm.templateContent && !templateForm.templateConfig) {
        throw new Error('No template URLs found')
      }

      const zip = new JSZip()

      // Add template content PDF if exists
      if (templateForm.templateContent) {
        try {
          const templatePdf = await this.pdfConverterService.convertDocxToPdfFromS3(templateForm.templateContent)
          zip.file('template-content.pdf', templatePdf)
        } catch (error) {
          console.warn('Failed to convert template content:', error.message)
        }
      }

      // Add template config PDF if exists
      if (templateForm.templateConfig) {
        try {
          const configPdf = await this.pdfConverterService.convertDocxToPdfFromS3(templateForm.templateConfig)
          zip.file('template-config.pdf', configPdf)
        } catch (error) {
          console.warn('Failed to convert template config:', error.message)
        }
      }

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
      return zipBuffer
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        throw error
      }
      throw new Error(`Failed to generate template ZIP: ${error.message}`)
    }
  }

  /**
   * Preprocess sections to set hardcoded options for FINAL_SCORE_TEXT when FINAL_SCORE_NUM is not present
   */
  private preprocessFinalScoreTextOptions(sections: any[]): any[] {
    // Collect all fields from all sections to check for FINAL_SCORE_NUM
    const allFields: any[] = []
    for (const section of sections) {
      if (section.fields && Array.isArray(section.fields)) {
        allFields.push(...section.fields)
      }
    }

    const hasFinalScoreNum = allFields.some((field: any) => field.fieldType === 'FINAL_SCORE_NUM')

    // If no FINAL_SCORE_NUM exists, set hardcoded options for FINAL_SCORE_TEXT fields
    if (!hasFinalScoreNum) {
      const processedSections = sections.map((section) => {
        if (!section.fields || !Array.isArray(section.fields)) return section

        const processedFields = section.fields.map((field: any) => {
          if (field.fieldType === 'FINAL_SCORE_TEXT') {
            return {
              ...field,
              options: { items: ['Pass', 'Fail'] } // Hardcoded JSONB options
            }
          }
          return field
        })

        return {
          ...section,
          fields: processedFields
        }
      })

      return processedSections
    }

    // If FINAL_SCORE_NUM exists, return sections as-is
    return sections
  }

  /**
   * Validate template business rules
   */
  private validateTemplateBusinessRules(sections: any[]) {
    // Collect all fields from all sections
    const allFields: any[] = []

    for (const section of sections) {
      if (!section.fields || !Array.isArray(section.fields)) continue

      // 1. Check toggle dependent sections
      if (section.isToggleDependent === true) {
        const hasControlToggle = section.fields.some((field: any) => field.fieldType === 'SECTION_CONTROL_TOGGLE')
        if (!hasControlToggle) {
          throw new ToggleDependentSectionMissingControlError(section.label)
        }
      }

      // 2. Check VALUE_LIST fields have options
      for (const field of section.fields) {
        if (field.fieldType === 'VALUE_LIST') {
          if (!field.options) {
            throw new ValueListFieldMissingOptionsError(field.fieldName, section.label)
          }

          // Validate options format
          try {
            const options = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
            if (!options.items || !Array.isArray(options.items)) {
              throw new ValueListFieldInvalidOptionsError(field.fieldName, section.label)
            }
          } catch (error) {
            throw new ValueListFieldInvalidOptionsError(field.fieldName, section.label)
          }
        }

        allFields.push(field)
      }

      // 3. Check CHECK_BOX fields validation
      for (const field of section.fields) {
        if (field.fieldType === 'CHECK_BOX') {
          // Find all child fields of this CHECK_BOX
          const childFields = section.fields.filter(
            (childField: any) =>
              childField.parentTempId === field.tempId ||
              childField.parentTempId === field.fieldName ||
              (childField.parentTempId && field.tempId && childField.parentTempId.includes(field.tempId))
          )

          // Validate that all child fields are TEXT type only
          for (const childField of childFields) {
            if (childField.fieldType !== 'TEXT') {
              throw new CheckBoxFieldInvalidChildTypeError(field.fieldName, childField.fieldType, childField.fieldName)
            }
          }
        }
      }

      // 4. Check PART fields validation
      for (const field of section.fields) {
        if (field.fieldType === 'PART') {
          // Find all child fields of this PART
          const childFields = section.fields.filter(
            (childField: any) =>
              childField.parentTempId === field.tempId ||
              childField.parentTempId === field.fieldName ||
              (childField.parentTempId && field.tempId && childField.parentTempId.includes(field.tempId))
          )

          // Validate that PART children don't include restricted field types
          const restrictedTypes = [
            'PART',
            'TOGGLE',
            'SECTION_CONTROL_TOGGLE',
            'FINAL_SCORE_TEXT',
            'FINAL_SCORE_NUM',
            'CHECK_BOX'
          ]
          for (const childField of childFields) {
            if (restrictedTypes.includes(childField.fieldType)) {
              throw new PartFieldInvalidChildTypeError(
                field.fieldName,
                childField.fieldType,
                childField.fieldName,
                restrictedTypes
              )
            }
          }
        }
      }
    }

    // 5. Check signature field requirements
    const hasSignatureField = allFields.some(
      (field: any) => field.fieldType === 'SIGNATURE_DRAW' || field.fieldType === 'SIGNATURE_IMG'
    )
    if (!hasSignatureField) {
      throw new MissingSignatureFieldError()
    }

    // 5.1. Check TRAINEE must have at least one SIGNATURE_DRAW field (trainee must sign)
    const traineeSignatureDrawFields = allFields.filter(
      (field: any) => field.fieldType === 'SIGNATURE_DRAW' && field.roleRequired === 'TRAINEE'
    )
    if (traineeSignatureDrawFields.length === 0) {
      throw new Error('Template must have at least one SIGNATURE_DRAW field with roleRequired set to TRAINEE')
    }

    // 5.2. Check TRAINEE cannot use SIGNATURE_IMG (only SIGNATURE_DRAW allowed)
    const traineeSignatureImgFields = allFields.filter(
      (field: any) => field.fieldType === 'SIGNATURE_IMG' && field.roleRequired === 'TRAINEE'
    )
    if (traineeSignatureImgFields.length > 0) {
      throw new Error(
        'TRAINEE roleRequired fields cannot use SIGNATURE_IMG fieldType, only SIGNATURE_DRAW is allowed for trainees'
      )
    }

    // 5.1. Check at least one submittable section
    const hasSubmittableSection = sections.some((section: any) => section.isSubmittable === true)
    if (!hasSubmittableSection) {
      throw new MissingSubmittableSectionError()
    }

    // 6. Check at least one FINAL_SCORE_NUM or FINAL_SCORE_TEXT field
    const finalScoreNumFields = allFields.filter((field: any) => field.fieldType === 'FINAL_SCORE_NUM')
    const finalScoreTextFields = allFields.filter((field: any) => field.fieldType === 'FINAL_SCORE_TEXT')

    // Must have at least one final score field (either NUM or TEXT)
    if (finalScoreNumFields.length === 0 && finalScoreTextFields.length === 0) {
      throw new MissingFinalScoreFieldsError('FINAL_SCORE_NUM')
    }

    // Check maximum one of each type
    if (finalScoreNumFields.length > 1) {
      throw new DuplicateFinalScoreFieldsError('FINAL_SCORE_NUM')
    }
    if (finalScoreTextFields.length > 1) {
      throw new DuplicateFinalScoreFieldsError('FINAL_SCORE_TEXT')
    }

    // 7. FINAL_SCORE_TEXT validation - options are automatically set if needed
    // No validation needed here as options are handled in preprocessing
    // If both FINAL_SCORE_NUM and FINAL_SCORE_TEXT exist, options are optional for FINAL_SCORE_TEXT

    // 8. Validate PART and CHECK_BOX fields have children (only for PENDING status)
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.fieldType === 'PART' || field.fieldType === 'CHECK_BOX') {
          // Check if field has children property (nested structure)
          if (field.children && Array.isArray(field.children)) {
            if (field.children.length === 0) {
              throw new PartFieldMissingChildrenError(field.fieldName, section.label)
            }

            // Validate that all children are TEXT type
            for (const child of field.children) {
              if (child.fieldType !== 'TEXT') {
                throw new Error(
                  `Child field '${child.fieldName}' of ${field.fieldType} field '${field.fieldName}' must be TEXT type, but found ${child.fieldType}`
                )
              }
            }

            // Recursively validate nested children if any
            const validateChildren = (children: any[], parentFieldName: string) => {
              for (const child of children) {
                if (child.fieldType === 'PART' || child.fieldType === 'CHECK_BOX') {
                  if (!child.children || child.children.length === 0) {
                    throw new PartFieldMissingChildrenError(child.fieldName, section.label)
                  }
                  validateChildren(child.children, child.fieldName)
                }
              }
            }
            validateChildren(field.children, field.fieldName)
          } else {
            // Check if field has children using parentTempId relationship (flat structure)
            const hasChildFields = section.fields.some(
              (childField: any) =>
                childField.parentTempId === field.tempId ||
                childField.parentTempId === field.fieldName ||
                (childField.parentTempId && field.tempId && childField.parentTempId.includes(field.tempId))
            )
            if (!hasChildFields) {
              if (field.fieldType === 'PART') {
                throw new PartFieldMissingChildrenError(field.fieldName, section.label)
              } else {
                throw new Error(
                  `CHECK_BOX field '${field.fieldName}' in section '${section.label}' must have at least one child field`
                )
              }
            }
          }
        }
      }
    }
  }

  /**
   * Get template PDF from template_content S3 URL
   */
  async exportTemplatePdfFromS3(templateContentUrl: string): Promise<Buffer> {
    try {
      if (!templateContentUrl) {
        throw new Error('Template content URL not found')
      }

      // Convert DOCX to PDF using the shared service
      const pdfBuffer = await this.pdfConverterService.convertDocxToPdfFromS3(templateContentUrl)
      return pdfBuffer
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        throw error
      }
      throw new Error(`Failed to generate template PDF: ${error.message}`)
    }
  }

  /**
   * Delete a DRAFT template permanently
   * Only users with appropriate permissions can delete templates in their department
   */
  async deleteDraftTemplate(
    templateId: string,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // First get template to verify ownership and department
      const template = await this.templateRepository.findTemplateById(templateId)

      if (!template) {
        throw new TemplateNotFoundError(templateId)
      }

      // Verify user has permission to delete (department match)
      if (userContext.departmentId && template.departmentId !== userContext.departmentId) {
        throw new Error('You can only delete templates in your department')
      }

      // Check if template is DRAFT status
      if (template.status !== 'DRAFT') {
        throw new Error('Only DRAFT templates can be deleted')
      }

      // Delete the template
      await this.templateRepository.deleteDraftTemplate(templateId)

      return {
        success: true,
        message: TEMPLATE_DELETED_SUCCESSFULLY(template.name)
      }
    } catch (error) {
      if (error instanceof TemplateNotFoundError || error instanceof InvalidDraftTemplateStatusError) {
        throw error
      }
      throw new Error(`Failed to delete template: ${error.message}`)
    }
  }
}

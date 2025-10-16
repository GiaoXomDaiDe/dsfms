import { BadRequestException, Injectable, ForbiddenException } from '@nestjs/common'
import PizZip = require('pizzip')
import Docxtemplater = require('docxtemplater')
import { TemplateRepository } from './template.repository'
import { CreateTemplateFormDto } from './template.dto'

interface PlaceholderInfo {
  type: 'field' | 'section' | 'condition' | 'inverted'
  name: string
  children?: string[]
}

@Injectable()
export class TemplateService {
  constructor(private readonly templateRepository: TemplateRepository) {}
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
      // Validate type của file
      if (!file.originalname.endsWith('.docx')) {
        throw new BadRequestException('Only .docx files are allowed')
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
        message: 'Template parsed successfully',
        schema,
        placeholders
      }
    } catch (error) {
      // console.error('Error parsing DOCX template:', error)

      // xử lí các lỗi với docxtemplater
      if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors
          .map((err: any) => {
            return `${err.name}: ${err.message} at ${err.part}`
          })
          .join('; ')
        throw new BadRequestException(`Failed to parse template: ${errorMessages}`)
      }

      // xử lí 400
      throw new BadRequestException(`Failed to parse template: ${error.message || 'Unknown error'}`)
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
   * Excludes section tags that start with # ^ or /
   */
  private hasOperator(field: string): boolean {
    // Skip section tags (starting with #, ^, or /)
    if (field.startsWith('#') || field.startsWith('^') || field.startsWith('/')) {
      return false
    }
    // Check for mathematical operations
    return /[+\-*/]/.test(field)
  }

  /**
   * Parse DOCX and extract only field names (placeholders)
   * Returns a flat list of fields without template or section structure
   * This is useful for users to see what fields are in the document before organizing them
   */
  async extractFieldsFromDocx(file: any): Promise<{
    success: boolean
    message: string
    fields: Array<{
      fieldName: string
      placeholder: string
    }>
    totalFields: number
  }> {
    try {
      // Validate file type
      if (!file.originalname.endsWith('.docx')) {
        throw new BadRequestException('Only .docx files are allowed')
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
      
      // Process placeholders to get unique field names and detect parent sections
      const fieldSet = new Set<string>()
      const parentSections = new Set<string>()
      const fields: Array<{ fieldName: string; placeholder: string }> = []

      // First pass: identify section start tags (parent PART fields)
      for (const tag of tags) {
        const cleaned = tag.replace(/[{}]/g, '')
        
        // Detect section start tags (#sectionName)
        if (cleaned.startsWith('#')) {
          const sectionName = cleaned.substring(1)
          parentSections.add(sectionName)
        }
      }

      // Second pass: process all fields and include parent sections
      for (const tag of tags) {
        const cleaned = tag.replace(/[{}]/g, '')
        
        // Skip section control tags (^, /) but NOT start tags (#)
        if (cleaned.startsWith('^') || cleaned.startsWith('/')) {
          continue
        }

        // Handle section start tags (#sectionName) - these become PART fields
        if (cleaned.startsWith('#')) {
          const sectionName = cleaned.substring(1)
          if (!fieldSet.has(sectionName)) {
            fieldSet.add(sectionName)
            fields.push({
              fieldName: sectionName,
              placeholder: `{${sectionName}}` // Convert to standard placeholder format
            })
          }
          continue
        }

        // Skip fields with operators (calculated fields)
        if (this.hasOperator(cleaned)) {
          continue
        }

        // Add unique regular fields only
        if (!fieldSet.has(cleaned)) {
          fieldSet.add(cleaned)
          fields.push({
            fieldName: cleaned,
            placeholder: tag
          })
        }
      }

      return {
        success: true,
        message: `Extracted ${fields.length} unique fields from document`,
        fields,
        totalFields: fields.length
      }
    } catch (error) {
      // Handle docxtemplater errors
      if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors
          .map((err: any) => {
            return `${err.name}: ${err.message} at ${err.part}`
          })
          .join('; ')
        throw new BadRequestException(`Failed to parse template: ${errorMessages}`)
      }

      // Handle other errors
      throw new BadRequestException(`Failed to parse template: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Create a complete template with sections and fields
   * Only ADMINISTRATOR role can create templates
   */
  async createTemplate(templateData: CreateTemplateFormDto, currentUser: any) {
    // Check if user has ADMINISTRATOR role
    if (currentUser.roleName !== 'ADMINISTRATOR') {
      throw new ForbiddenException('Only ADMINISTRATOR role can create templates')
    }

    // Validate department exists
    const departmentExists = await this.templateRepository.validateDepartmentExists(templateData.departmentId)
    if (!departmentExists) {
      throw new BadRequestException(`Department with ID '${templateData.departmentId}' does not exist`)
    }

    try {
      // Generate nested template schema from sections and fields
      const templateSchema = this.generateNestedSchemaFromSections(templateData.sections);

      // Create template with all nested data
      // Use alternative method for large templates if needed
      const result = await this.templateRepository.createTemplateWithSectionsAndFields(
        templateData,
        currentUser.userId,
        templateSchema
      )

      return {
        success: true,
        data: result,
        message: 'Template created successfully'
      }
    } catch (error) {
      throw new BadRequestException(`Failed to create template: ${error.message}`)
    }
  }

  /**
   * Create a new version of an existing template
   */
  async createTemplateVersion(originalTemplateId: string, templateData: CreateTemplateFormDto, currentUser: any) {
    // Check if user has ADMINISTRATOR role
    if (currentUser.roleName !== 'ADMINISTRATOR') {
      throw new ForbiddenException('Only ADMINISTRATOR role can create template versions')
    }

    // Validate that original template exists
    const originalTemplateExists = await this.templateRepository.templateExists(originalTemplateId)
    if (!originalTemplateExists) {
      throw new BadRequestException(`Original template with ID '${originalTemplateId}' does not exist`)
    }

    // Validate department exists
    const departmentExists = await this.templateRepository.validateDepartmentExists(templateData.departmentId)
    if (!departmentExists) {
      throw new BadRequestException(`Department with ID '${templateData.departmentId}' does not exist`)
    }

    try {
      // Get the original template to determine the first version ID
      const originalTemplate = await this.templateRepository.findTemplateById(originalTemplateId)
      if (!originalTemplate) {
        throw new BadRequestException('Original template not found')
      }

      // Determine which template group this belongs to
      const firstVersionId = originalTemplate.referFirstVersionId || originalTemplateId

      // Get the next version number
      const maxVersion = await this.templateRepository.getMaxVersionNumber(firstVersionId)
      const newVersion = maxVersion + 1

      // Generate nested template schema from sections and fields
      const templateSchema = this.generateNestedSchemaFromSections(templateData.sections);

      // Create the new version
      const result = await this.templateRepository.createNewVersion(
        originalTemplateId,
        { ...templateData, templateSchema },
        newVersion,
        currentUser.userId
      )

      return {
        success: true,
        data: result,
        message: `Template version ${newVersion} created successfully`,
        version: newVersion,
        referFirstVersionId: firstVersionId
      }
    } catch (error) {
      throw new BadRequestException(`Failed to create template version: ${error.message}`)
    }
  }

  /**
   * Get all versions of a template
   */
  async getTemplateVersions(templateId: string) {
    const template = await this.templateRepository.findTemplateById(templateId)
    if (!template) {
      throw new BadRequestException('Template not found')
    }

    // Get the first version ID (either the template itself or its reference)
    const firstVersionId = template.referFirstVersionId || templateId

    // Get all versions
    const versions = await this.templateRepository.findTemplatesByFirstVersionId(firstVersionId)

    return {
      success: true,
      data: versions,
      message: 'Template versions retrieved successfully',
      totalVersions: versions.length,
      firstVersionId
    }
  }

  /**
   * Get template by ID with full details
   */
  async getTemplateById(id: string) {
    const template = await this.templateRepository.findTemplateById(id)

    if (!template) {
      throw new BadRequestException('Template not found')
    }

    return {
      success: true,
      data: template,
      message: 'Template retrieved successfully'
    }
  }

  /**
   * Get template schema by ID - Returns template in the same format as create template API
   * This is useful for editing/cloning templates
   */
  async getTemplateSchemaById(id: string) {
    const template = await this.templateRepository.findTemplateById(id)

    if (!template) {
      throw new BadRequestException('Template not found')
    }

    // Transform the template data to match the create template format for FE editing
    const templateStructure = {
      name: template.name,
      description: template.description,
      departmentId: template.departmentId,
      templateContent: template.templateContent,
      sections: template.sections.map(section => ({
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
    };

    return {
      success: true,
      data: templateStructure, // Complete structure for FE editing
      schema: template.templateSchema, // Raw templateSchema for form rendering
      metadata: {
        templateId: template.id,
        version: template.version,
        isActive: template.isActive,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        department: template.department,
        createdByUser: template.createdByUser
      },
      message: 'Template schema retrieved successfully'
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
      case 'CHECK_BOX':
      case 'TOGGLE':
      case 'SECTION_CONTROL_TOGGLE':
        return false
      case 'NUMBER':
      case 'FINAL_SCORE_NUM':
        return 0
      default:
        return ''
    }
  }

  /**
   * Get all templates
   */
  async getAllTemplates() {
    const templates = await this.templateRepository.findAllTemplates()

    return {
      success: true,
      data: templates,
      message: 'Templates retrieved successfully'
    }
  }

  /**
   * Get templates by department
   */
  async getTemplatesByDepartment(departmentId: string) {
    const templates = await this.templateRepository.findTemplatesByDepartment(departmentId)

    return {
      success: true,
      data: templates,
      message: 'Department templates retrieved successfully'
    };
  }

  /**
   * Generate nested schema based on field hierarchy (parent-child relationships)
   */
  private generateNestedSchemaFromSections(sections: any[]): Record<string, any> {
    const schema: Record<string, any> = {};
    
    sections.forEach(section => {
      // Build field maps for parent-child relationships
      const fieldByTempId = new Map<string, any>();
      const fieldByName = new Map<string, any>();
      const rootFields: any[] = [];
      
      // First pass: create field maps and identify parent fields
      section.fields.forEach((field: any) => {
        const fieldObj = {
          name: field.fieldName,
          tempId: field.tempId,
          parentTempId: field.parentTempId,
          type: this.getSchemaTypeFromFieldType(field.fieldType),
          children: [] as any[]
        };
        
        // Map by both tempId (if exists) and field name
        if (field.tempId) {
          fieldByTempId.set(field.tempId, fieldObj);
        }
        fieldByName.set(field.fieldName, fieldObj);
        
        // If no parent, it's a root field
        if (!field.parentTempId) {
          rootFields.push(fieldObj);
        }
      });
      
      // Second pass: build parent-child relationships using tempId references
      section.fields.forEach((field: any) => {
        if (field.parentTempId) {
          const parentField = fieldByTempId.get(field.parentTempId);
          const currentField = fieldByName.get(field.fieldName);
          
          if (parentField && currentField) {
            parentField.children.push(currentField);
          }
        }
      });
      
      // Build nested schema structure
      this.buildNestedSchemaFromFields(rootFields, schema);
    });
    
    return schema;
  }
  
  /**
   * Recursively build nested schema structure from field hierarchy
   */
  private buildNestedSchemaFromFields(fields: any[], target: Record<string, any>): void {
    fields.forEach(field => {
      if (field.children && field.children.length > 0) {
        // This field has children - create an object
        // For PART type fields, use the field name as the object key
        if (field.type === 'part') {
          target[field.name] = {};
          this.buildNestedSchemaFromFields(field.children, target[field.name]);
        } else {
          // Non-part field with children (shouldn't happen but handle anyway)
          target[field.name] = {};
          this.buildNestedSchemaFromFields(field.children, target[field.name]);
        }
      } else {
        // Leaf field - set default value based on type
        // Skip PART type fields without children
        if (field.type !== 'part') {
          target[field.name] = this.getDefaultValueForType(field.type);
        }
      }
    });
  }
  
  /**
   * Get schema type from FieldType enum
   */
  private getSchemaTypeFromFieldType(fieldType: string): string {
    switch (fieldType) {
      case 'TOGGLE':
        return 'boolean';
      case 'NUMBER':
        return 'number';
      case 'PART':
        return 'part'; // Special type for parent/section fields
      case 'TEXT':
      case 'IMAGE':
      case 'SIGNATURE_DRAW':
      case 'SIGNATURE_IMG':
      default:
        return 'string';
    }
  }
  
  /**
   * Get default value for schema type
   */
  private getDefaultValueForType(type: string): any {
    switch (type) {
      case 'boolean':
        return false;
      case 'number':
        return 0;
      case 'string':
      default:
        return '';
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

}

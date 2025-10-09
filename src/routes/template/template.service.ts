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
      const placeholders: string[] = tags.map(tag => String(tag))
      
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
        const errorMessages = error.properties.errors.map((err: any) => {
          return `${err.name}: ${err.message} at ${err.part}`
        }).join('; ')
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
        const hasInverted = placeholders.some(p => p.replace(/[{}]/g, '') === `^${sectionName}`)
        
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
      
      // Process placeholders to get unique field names
      const fieldSet = new Set<string>()
      const fields: Array<{ fieldName: string; placeholder: string }> = []

      for (const tag of tags) {
        const cleaned = tag.replace(/[{}]/g, '')
        
        // Skip section control tags (#, ^, /)
        if (cleaned.startsWith('#') || cleaned.startsWith('^') || cleaned.startsWith('/')) {
          continue
        }

        // Skip fields with operators (calculated fields)
        if (this.hasOperator(cleaned)) {
          continue
        }

        // Add unique fields only
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
        const errorMessages = error.properties.errors.map((err: any) => {
          return `${err.name}: ${err.message} at ${err.part}`
        }).join('; ')
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
  async createTemplate(
    templateData: CreateTemplateFormDto,
    currentUser: any
  ) {
    // Check if user has ADMINISTRATOR role
    if (currentUser.roleName !== 'ADMINISTRATOR') {
      throw new ForbiddenException('Only ADMINISTRATOR role can create templates');
    }

    // Validate department exists
    const departmentExists = await this.templateRepository.validateDepartmentExists(templateData.departmentId);
    if (!departmentExists) {
      throw new BadRequestException(`Department with ID '${templateData.departmentId}' does not exist`);
    }

    try {
      // Generate template schema from all field names in sections
      const allFieldNames = templateData.sections.flatMap(section => 
        section.fields.map(field => field.fieldName)
      );

      const templateSchema = this.generateSchemaFromFieldNames(allFieldNames);

      // Create template with all nested data
      const result = await this.templateRepository.createTemplateWithSectionsAndFields(
        templateData,
        currentUser.userId,
        templateSchema
      );

      return {
        success: true,
        data: result,
        message: 'Template created successfully'
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Get template by ID with full details
   */
  async getTemplateById(id: string) {
    const template = await this.templateRepository.findTemplateById(id);
    
    if (!template) {
      throw new BadRequestException('Template not found');
    }

    return {
      success: true,
      data: template,
      message: 'Template retrieved successfully'
    };
  }

  /**
   * Get template schema by ID - Returns template in the same format as create template API
   * This is useful for editing/cloning templates
   */
  async getTemplateSchemaById(id: string) {
    const template = await this.templateRepository.findTemplateById(id);
    
    if (!template) {
      throw new BadRequestException('Template not found');
    }

    // Transform the template data to match the create template format
    const schemaFormat = {
      name: template.name,
      description: template.description,
      departmentId: template.departmentId,
      templateContent: template.templateContent,
      sections: template.sections.map(section => ({
        label: section.label,
        displayOrder: section.displayOrder,
        editBy: section.editBy,
        roleInSubject: section.roleInSubject,
        isSubmittable: section.isSubmittable,
        isToggleDependent: section.isToggleDependent,
        fields: section.fields
          .filter(field => !field.parentId) // Get only parent fields first
          .map(field => this.buildFieldWithChildren(field, section.fields))
      }))
    };

    // Build nested schema structure from sections and fields
    const schema = this.buildNestedSchema(template.sections);

    return {
      success: true,
      data: schemaFormat,
      schema: schema,
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
    };
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
    };

    return fieldData;
  }

  /**
   * Build nested schema structure from sections and fields
   * Uses parent-child relationships to create nested objects
   */
  private buildNestedSchema(sections: any[]): Record<string, any> {
    const schema: Record<string, any> = {};

    // Process each section
    for (const section of sections) {
      // Process each field in the section
      for (const field of section.fields) {
        // If field has a parent, it's a child field
        if (field.parentId) {
          // Find the parent field
          const parentField = section.fields.find((f: any) => f.id === field.parentId);
          
          if (parentField) {
            const parentFieldName = parentField.fieldName;
            
            // Initialize parent object if not exists
            if (!schema[parentFieldName]) {
              schema[parentFieldName] = {};
            }
            
            // Add child field to parent object
            schema[parentFieldName][field.fieldName] = this.getDefaultValueForField(field);
          }
        } else {
          // Top-level field (no parent)
          // Check if this field has children
          const hasChildren = section.fields.some((f: any) => f.parentId === field.id);
          
          if (hasChildren) {
            // Initialize as object to hold children
            if (!schema[field.fieldName]) {
              schema[field.fieldName] = {};
            }
          } else {
            // Simple field with no children
            schema[field.fieldName] = this.getDefaultValueForField(field);
          }
        }
      }
    }

    return schema;
  }

  /**
   * Get default value for a field based on its type
   */
  private getDefaultValueForField(field: any): any {
    switch (field.fieldType) {
      case 'CHECK_BOX':
      case 'TOGGLE':
      case 'SECTION_CONTROL_TOGGLE':
        return false;
      case 'NUMBER':
      case 'FINAL_SCORE_NUM':
        return 0;
      default:
        return '';
    }
  }

  /**
   * Get all templates
   */
  async getAllTemplates() {
    const templates = await this.templateRepository.findAllTemplates();

    return {
      success: true,
      data: templates,
      message: 'Templates retrieved successfully'
    };
  }

  /**
   * Get templates by department
   */
  async getTemplatesByDepartment(departmentId: string) {
    const templates = await this.templateRepository.findTemplatesByDepartment(departmentId);

    return {
      success: true,
      data: templates,
      message: 'Department templates retrieved successfully'
    };
  }

  /**
   * Generate basic schema from field names
   */
  private generateSchemaFromFieldNames(fieldNames: string[]): Record<string, any> {
    const schema: Record<string, any> = {};
    
    fieldNames.forEach(fieldName => {
      // Remove curly braces if present and clean field name
      const cleanName = fieldName.replace(/[{}]/g, '').trim();
      
      schema[cleanName] = {
        type: 'string',
        required: false,
        description: `Field: ${cleanName}`
      };
    });

    return {
      type: 'object',
      properties: schema,
      additionalProperties: false
    };
  }
}

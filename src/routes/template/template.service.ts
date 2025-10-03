import { BadRequestException, Injectable } from '@nestjs/common'
import PizZip = require('pizzip')
import Docxtemplater = require('docxtemplater')

interface PlaceholderInfo {
  type: 'field' | 'section' | 'condition' | 'inverted'
  name: string
  children?: string[]
}

@Injectable()
export class TemplateService {
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
          schema[sectionName] = true
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
}

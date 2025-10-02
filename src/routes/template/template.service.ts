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
   * Parse DOCX file and extract all placeholders
   * Returns a JSON schema based on the placeholders found
   */
  async parseDocxTemplate(file: any): Promise<{
    success: boolean
    message: string
    schema: Record<string, any>
    placeholders: string[]
  }> {
    try {
      // Validate file type
      if (!file.originalname.endsWith('.docx')) {
        throw new BadRequestException('Only .docx files are allowed')
      }

      // Load the docx file
      const zip = new PizZip(file.buffer)
      
      // Use docxtemplater to properly extract placeholders
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true
      })

      // Get the full text content and extract placeholders
      const fullText = doc.getFullText()
      console.log('Full text content:', fullText)
      
      // Find all placeholders in the text content
      const tags = fullText.match(/\{[^}]+\}/g) || []
      
      console.log('Found tags:', tags)
      
      // Keep all placeholders (don't deduplicate) to preserve order and structure
      const placeholders: string[] = tags.map(tag => String(tag))
      
      console.log('All placeholders (in order):', placeholders)
      console.log('Total placeholders count:', placeholders.length)

      // Parse placeholders and build schema
      const schema = this.buildSchemaFromPlaceholders(placeholders)

      return {
        success: true,
        message: 'Template parsed successfully',
        schema,
        placeholders
      }
    } catch (error) {
      console.error('Error parsing DOCX template:', error)
      
      // Handle docxtemplater specific errors
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
   * Build JSON schema from extracted placeholders by processing them sequentially
   */
  private buildSchemaFromPlaceholders(placeholders: string[]): Record<string, any> {
    const schema: Record<string, any> = {}
    let currentSection: string | null = null
    const conditionalSections = new Set<string>()

    // Process placeholders in order from start to end
    for (let i = 0; i < placeholders.length; i++) {
      const placeholder = placeholders[i]
      const cleaned = placeholder.replace(/[{}]/g, '')
      
      // Skip operators (they will be calculated automatically)
      if (this.hasOperator(cleaned)) {
        continue
      }

      console.log(`Processing [${i}]: ${cleaned}, Current section: ${currentSection}`)

      // Section start: {#name}
      if (cleaned.startsWith('#')) {
        const sectionName = cleaned.substring(1)
        currentSection = sectionName
        
        // Check if this is a conditional section by looking ahead for inverted section
        const hasInverted = placeholders.some(p => p.replace(/[{}]/g, '') === `^${sectionName}`)
        
        if (hasInverted) {
          // This is a boolean condition
          schema[sectionName] = true
          conditionalSections.add(sectionName)
          console.log(`  -> Added conditional section: ${sectionName}`)
        } else {
          // This is an object section
          schema[sectionName] = {}
          console.log(`  -> Added object section: ${sectionName}`)
        }
      }
      // Section end: {/name}
      else if (cleaned.startsWith('/')) {
        const sectionName = cleaned.substring(1)
        if (currentSection === sectionName) {
          currentSection = null
          console.log(`  -> Closed section: ${sectionName}`)
        }
      }
      // Inverted section (condition): {^name}
      else if (cleaned.startsWith('^')) {
        // Skip, already handled when processing section start
        console.log(`  -> Skipped inverted section: ${cleaned}`)
        continue
      }
      // Regular field: {name}
      else {
        if (currentSection && !conditionalSections.has(currentSection)) {
          // Field belongs to current section (non-conditional object section)
          schema[currentSection][cleaned] = ''
          console.log(`  -> Added field ${cleaned} to section ${currentSection}`)
        } else {
          // Field is at root level (either no current section or in conditional section)
          schema[cleaned] = ''
          console.log(`  -> Added root field: ${cleaned}`)
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

import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import { CreateTemplateFormDto, CreateTemplateVersionDto } from './template.dto'

@Injectable()
export class TemplateRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Validate parent-child field relationships before creating
   * @throws Error if validation fails
   */
  private validateFieldHierarchy(fields: any[]): void {
    const fieldsByTempId = new Map<string, any>()
    fields.forEach((f) => {
      if (f.tempId) {
        fieldsByTempId.set(f.tempId, f)
      }
    })

    for (const field of fields) {
      if (field.parentTempId) {
        // Check if parent exists in the same section by tempId
        if (!fieldsByTempId.has(field.parentTempId)) {
          throw new Error(
            `Field '${field.fieldName}' references parent '${field.parentTempId}' which does not exist in the same section`
          )
        }
      }
    }

    // Check for self-reference
    for (const field of fields) {
      if (field.parentTempId === field.tempId) {
        throw new Error(`Field '${field.fieldName}' cannot be its own parent`)
      }
    }

    // Detect cycles using DFS
    const buildAdjList = () => {
      const adjList = new Map<string, string[]>()
      for (const field of fields) {
        if (!adjList.has(field.fieldName)) {
          adjList.set(field.fieldName, [])
        }
        if (field.parentTempId) {
          const parentField = fieldsByTempId.get(field.parentTempId)
          if (parentField) {
            if (!adjList.has(parentField.fieldName)) {
              adjList.set(parentField.fieldName, [])
            }
            adjList.get(parentField.fieldName)!.push(field.fieldName)
          }
        }
      }
      return adjList
    }

    const hasCycle = (adjList: Map<string, string[]>) => {
      const visited = new Set<string>()
      const recStack = new Set<string>()

      const dfs = (node: string): boolean => {
        visited.add(node)
        recStack.add(node)

        const neighbors = adjList.get(node) || []
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true
          } else if (recStack.has(neighbor)) {
            return true // Cycle detected
          }
        }

        recStack.delete(node)
        return false
      }

      for (const node of adjList.keys()) {
        if (!visited.has(node)) {
          if (dfs(node)) return true
        }
      }
      return false
    }

    const adjList = buildAdjList()
    if (hasCycle(adjList)) {
      throw new Error(
        'Circular reference detected in field hierarchy. ' +
          'Fields cannot form a cycle through parent-child relationships.'
      )
    }
  }

  async createTemplateWithSectionsAndFields(
    templateData: CreateTemplateFormDto,
    createdByUserId: string,
    templateSchema?: any
  ) {
    return this.prismaService.$transaction(
      async (tx) => {
        // 1. Create Template Form
        const templateForm = await tx.templateForm.create({
          data: {
            name: templateData.name,
            description: templateData.description,
            version: 1,
            departmentId: templateData.departmentId || undefined,
            createdByUserId,
            updatedByUserId: createdByUserId,
            status: 'PENDING',
            templateContent: templateData.templateContent || '',
            templateConfig: templateData.templateConfig,
            referFirstVersionId: null,
            templateSchema: templateSchema || null
          }
        })

        // 2. Create Template Sections first (batch operation)
        const sectionsToCreate = templateData.sections.map((sectionData) => ({
          templateId: templateForm.id,
          label: sectionData.label,
          displayOrder: sectionData.displayOrder,
          editBy: sectionData.editBy,
          roleInSubject: sectionData.roleInSubject,
          isSubmittable: sectionData.isSubmittable || false,
          isToggleDependent: sectionData.isToggleDependent || false
        }))

        // Create all sections at once
        const createdSections: any[] = []
        for (let i = 0; i < sectionsToCreate.length; i++) {
          const section = await tx.templateSection.create({
            data: sectionsToCreate[i]
          })
          createdSections.push(section)
        }

        // 3. Create fields with proper parent-child relationships
        const createdFieldsBySections = new Map<number, any[]>()

        for (let sectionIndex = 0; sectionIndex < templateData.sections.length; sectionIndex++) {
          const sectionData = templateData.sections[sectionIndex]
          const section = createdSections[sectionIndex]

          // Validate field hierarchy before processing
          this.validateFieldHierarchy(sectionData.fields)

          // Create mapping for tempId to actual field for this section
          const tempIdToFieldMap = new Map<string, any>()
          const createdFieldsForSection = []

          // First pass: Create parent fields (those without parentTempId)
          const parentFields = sectionData.fields.filter(field => !field.parentTempId)
          for (const fieldData of parentFields) {
            const field = await tx.templateField.create({
              data: {
                sectionId: section.id,
                label: fieldData.label,
                fieldName: fieldData.fieldName,
                fieldType: fieldData.fieldType,
                roleRequired: fieldData.roleRequired,
                options: fieldData.options,
                displayOrder: fieldData.displayOrder,
                parentId: null, // Parent fields have no parent
                createdById: createdByUserId
              }
            })
            createdFieldsForSection.push(field)
            
            // Map tempId to actual field for child field references
            if (fieldData.tempId) {
              tempIdToFieldMap.set(fieldData.tempId, field)
            }
          }

          // Second pass: Create child fields (those with parentTempId)
          const childFields = sectionData.fields.filter(field => field.parentTempId)
          for (const fieldData of childFields) {
            // Find the parent field using tempId mapping
            const parentField = fieldData.parentTempId ? tempIdToFieldMap.get(fieldData.parentTempId) : null
            
            if (fieldData.parentTempId && !parentField) {
              throw new Error(`Parent field with tempId '${fieldData.parentTempId}' not found for field '${fieldData.fieldName}'`)
            }
            
            const field = await tx.templateField.create({
              data: {
                sectionId: section.id,
                label: fieldData.label,
                fieldName: fieldData.fieldName,
                fieldType: fieldData.fieldType,
                roleRequired: fieldData.roleRequired,
                options: fieldData.options,
                displayOrder: fieldData.displayOrder,
                parentId: parentField ? parentField.id : null, // Link to parent field
                createdById: createdByUserId
              }
            })
            createdFieldsForSection.push(field)
          }

          createdFieldsBySections.set(sectionIndex, createdFieldsForSection)
        }

        // 4. Build final result
        const finalSections = createdSections.map((section, index) => ({
          ...section,
          fields: createdFieldsBySections.get(index) || []
        }))

        return {
          templateForm,
          sections: finalSections
        }
      },
      {
        timeout: 30000 // Increase timeout to 30 seconds
      }
    )
  }

  // Alternative method without transaction for large templates
  async createTemplateWithSectionsAndFieldsNoTransaction(
    templateData: CreateTemplateFormDto,
    createdByUserId: string,
    templateSchema?: any
  ) {
    let templateForm: any = null

    try {
      // 1. Create Template Form first
      templateForm = await this.prismaService.templateForm.create({
        data: {
          name: templateData.name,
          description: templateData.description,
          version: 1,
          departmentId: templateData.departmentId,
          createdByUserId,
          updatedByUserId: createdByUserId,
          status: 'PENDING',
          templateContent: templateData.templateContent || '',
          templateConfig: templateData.templateConfig,
          referFirstVersionId: null,
          templateSchema: templateSchema || null
        }
      })

      // 2. Create sections and fields without transaction
      const createdSections = []

      for (const sectionData of templateData.sections) {
        // Create section
        const section = await this.prismaService.templateSection.create({
          data: {
            templateId: templateForm.id,
            label: sectionData.label,
            displayOrder: sectionData.displayOrder,
            editBy: sectionData.editBy,
            roleInSubject: sectionData.roleInSubject,
            isSubmittable: sectionData.isSubmittable || false,
            isToggleDependent: sectionData.isToggleDependent || false
          }
        })

        // Create fields for this section
        const createdFields = []
        for (const fieldData of sectionData.fields) {
          const field = await this.prismaService.templateField.create({
            data: {
              sectionId: section.id,
              label: fieldData.label,
              fieldName: fieldData.fieldName,
              fieldType: fieldData.fieldType,
              roleRequired: fieldData.roleRequired,
              options: fieldData.options,
              displayOrder: fieldData.displayOrder,
              parentId: null,
              createdById: createdByUserId
            }
          })
          createdFields.push(field)
        }

        createdSections.push({
          ...section,
          fields: createdFields
        })
      }

      return {
        templateForm,
        sections: createdSections
      }
    } catch (error) {
      // If any error occurs, try to cleanup the template form
      if (templateForm?.id) {
        try {
          await this.prismaService.templateForm.delete({
            where: { id: templateForm.id }
          })
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
      throw error
    }
  }

  async findTemplateById(id: string) {
    return this.prismaService.templateForm.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        reviewedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        sections: {
          include: {
            fields: {
              include: {
                parent: true,
                children: true,
                createdBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              },
              orderBy: {
                displayOrder: 'asc'
              }
            }
          },
          orderBy: {
            displayOrder: 'asc'
          }
        }
      }
    })
  }

  async findAllTemplates(status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED') {
    const whereCondition: any = {};

    if (status) {
      whereCondition.status = status;
    }

    return this.prismaService.templateForm.findMany({
      where: whereCondition,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            sections: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async findTemplatesByDepartment(departmentId: string, status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED') {
    const whereCondition: any = {
      departmentId
    };

    // If status is provided, add it to where condition, otherwise get all statuses
    if (status) {
      whereCondition.status = status;
    }

    return this.prismaService.templateForm.findMany({
      where: whereCondition,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            sections: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async findTemplatesByCourse(courseId: string, status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED') {
    const whereCondition: any = {
      department: {
        courses: {
          some: {
            id: courseId
          }
        }
      }
    };

    // If status is provided, add it to where condition, otherwise get all statuses
    if (status) {
      whereCondition.status = status;
    }

    return this.prismaService.templateForm.findMany({
      where: whereCondition,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            sections: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async findTemplatesBySubject(subjectId: string, status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED') {
    const whereCondition: any = {
      department: {
        courses: {
          some: {
            subjects: {
              some: {
                id: subjectId
              }
            }
          }
        }
      }
    };

    // If status is provided, add it to where condition, otherwise get all statuses
    if (status) {
      whereCondition.status = status;
    }

    return this.prismaService.templateForm.findMany({
      where: whereCondition,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            sections: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async updateTemplateStatus(
    id: string, 
    status: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED', 
    updatedByUserId: string,
    isReviewAction: boolean = false
  ) {
    const updateData: any = {
      status,
      updatedByUserId,
      updatedAt: new Date()
    }

    // Set review fields only when transitioning from PENDING to PUBLISHED or REJECTED
    if (isReviewAction && (status === 'PUBLISHED' || status === 'REJECTED')) {
      updateData.reviewedByUserId = updatedByUserId
      updateData.reviewedAt = new Date()
    }

    return this.prismaService.templateForm.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        reviewedAt: true,
        updatedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        reviewedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })
  }

  async templateExists(id: string): Promise<boolean> {
    const template = await this.prismaService.templateForm.findUnique({
      where: { id },
      select: { id: true }
    })
    return !!template
  }

  async validateDepartmentExists(departmentId: string): Promise<boolean> {
    const department = await this.prismaService.department.findFirst({
      where: {
        id: departmentId,
        deletedAt: null,
        isActive: true
      },
      select: { id: true }
    })
    return !!department
  }

  /**
   * Check if template has been used to create any assessment forms
   */
  async templateHasAssessments(templateId: string): Promise<boolean> {
    const assessmentCount = await this.prismaService.assessmentForm.count({
      where: { templateId }
    })
    return assessmentCount > 0
  }

  /**
   * Check if template name already exists (excluding current template)
   */
  async templateNameExists(name: string, excludeTemplateId?: string): Promise<boolean> {
    const template = await this.prismaService.templateForm.findFirst({
      where: {
        name,
        ...(excludeTemplateId && { id: { not: excludeTemplateId } })
      },
      select: { id: true }
    })
    return !!template
  }

  /**
   * Update template basic information
   */
  async updateTemplateBasicInfo(
    templateId: string,
    updateData: { name?: string; description?: string; departmentId?: string },
    updatedByUserId: string
  ) {
    return this.prismaService.templateForm.update({
      where: { id: templateId },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.departmentId && { departmentId: updateData.departmentId }),
        updatedByUserId,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        description: true,
        departmentId: true,
        updatedAt: true,
        updatedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })
  }

  /**
   * Get the maximum version number for a template (including all versions)
   */
  async getMaxVersionForTemplate(originalTemplateId: string): Promise<number> {
    const maxVersionResult = await this.prismaService.templateForm.aggregate({
      where: {
        OR: [
          { id: originalTemplateId }, // Original template
          { referFirstVersionId: originalTemplateId } // All versions
        ]
      },
      _max: {
        version: true
      }
    })

    return maxVersionResult._max.version || 1
  }

  /**
   * Create a new version of an existing template
   */
  async createTemplateVersion(
    originalTemplateId: string,
    templateData: {
      name: string
      description?: string
      templateContent: string
      templateConfig: string
      sections: any[]
    },
    createdByUserId: string,
    templateSchema?: any
  ) {
    return this.prismaService.$transaction(
      async (tx) => {
        // 1. Get original template to get departmentId and calculate new version
        const originalTemplate = await tx.templateForm.findUnique({
          where: { id: originalTemplateId },
          select: { 
            id: true, 
            departmentId: true, 
            referFirstVersionId: true 
          }
        })

        if (!originalTemplate) {
          throw new Error('Original template not found')
        }

        // 2. Determine the first version ID (if original is already a version, use its referFirstVersionId)
        const firstVersionId = originalTemplate.referFirstVersionId || originalTemplateId

        // 3. Get the max version number for this template group
        const maxVersion = await this.getMaxVersionForTemplate(firstVersionId)
        const newVersion = maxVersion + 1

        // 4. Create new Template Form version
        const templateForm = await tx.templateForm.create({
          data: {
            name: templateData.name,
            description: templateData.description,
            version: newVersion,
            departmentId: originalTemplate.departmentId, // Keep same department
            createdByUserId,
            updatedByUserId: createdByUserId,
            reviewedByUserId: null, // Reset review fields
            reviewedAt: null,
            status: 'PENDING', // Always starts as pending
            templateContent: templateData.templateContent,
            templateConfig: templateData.templateConfig,
            referFirstVersionId: firstVersionId, // Reference to first version
            templateSchema: templateSchema || null
          }
        })

        // 5. Create Template Sections
        const sectionsToCreate = templateData.sections.map((sectionData) => ({
          templateId: templateForm.id,
          label: sectionData.label,
          displayOrder: sectionData.displayOrder,
          editBy: sectionData.editBy,
          roleInSubject: sectionData.roleInSubject,
          isSubmittable: sectionData.isSubmittable || false,
          isToggleDependent: sectionData.isToggleDependent || false
        }))

        // Create all sections
        const createdSections: any[] = []
        for (let i = 0; i < sectionsToCreate.length; i++) {
          const section = await tx.templateSection.create({
            data: sectionsToCreate[i]
          })
          createdSections.push(section)
        }

        // 6. Create all fields
        const allFieldsToCreate = []
        const sectionFieldMapping = new Map<number, any[]>()

        // Prepare all fields for batch creation
        for (let sectionIndex = 0; sectionIndex < templateData.sections.length; sectionIndex++) {
          const sectionData = templateData.sections[sectionIndex]
          const section = createdSections[sectionIndex]

          // Validate field hierarchy before processing
          this.validateFieldHierarchy(sectionData.fields)

          // Create fields for this section
          const fieldsForSection = sectionData.fields.map((fieldData: any) => ({
            sectionId: section.id,
            label: fieldData.label,
            fieldName: fieldData.fieldName,
            fieldType: fieldData.fieldType,
            roleRequired: fieldData.roleRequired,
            options: fieldData.options,
            displayOrder: fieldData.displayOrder,
            parentId: null, // No hierarchy in current implementation
            createdById: createdByUserId,
            updatedById: createdByUserId // Set updated by for new version
          }))

          sectionFieldMapping.set(sectionIndex, fieldsForSection)
          allFieldsToCreate.push(...fieldsForSection)
        }

        // Create all fields in batches
        const batchSize = 20
        const createdFieldsBySections = new Map<number, any[]>()

        for (let sectionIndex = 0; sectionIndex < templateData.sections.length; sectionIndex++) {
          const fieldsForSection = sectionFieldMapping.get(sectionIndex)
          const createdFieldsForSection = []

          if (fieldsForSection) {
            // Process fields for this section in batches
            for (let i = 0; i < fieldsForSection.length; i += batchSize) {
              const batch = fieldsForSection.slice(i, i + batchSize)

              // Create batch of fields
              for (const fieldData of batch) {
                const field = await tx.templateField.create({
                  data: fieldData
                })
                createdFieldsForSection.push(field)
              }
            }
          }

          createdFieldsBySections.set(sectionIndex, createdFieldsForSection)
        }

        // 7. Build final result
        const finalSections = createdSections.map((section, index) => ({
          ...section,
          fields: createdFieldsBySections.get(index) || []
        }))

        return {
          ...templateForm,
          sections: finalSections
        }
      },
      {
        maxWait: 15000,
        timeout: 30000
      }
    )
  }
}

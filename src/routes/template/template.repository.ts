import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import { CreateTemplateFormDto, CreateTemplateVersionDto } from './template.dto'
import { TemplateNotFoundError, InvalidTemplateStatusForUpdateError, TemplateInUseCannotUpdateError, InvalidDraftTemplateStatusError } from './template.error'

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
            status: (templateData as any).status || 'DRAFT',
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
          status: (templateData as any).status || 'DRAFT',
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
          select: {
            id: true,
            templateId: true,
            label: true,
            displayOrder: true,
            editBy: true,
            roleInSubject: true,
            isSubmittable: true,
            isToggleDependent: true,
            fields: {
              select: {
                id: true,
                sectionId: true,
                label: true,
                fieldName: true,
                fieldType: true,
                roleRequired: true,
                options: true,
                displayOrder: true,
                parentId: true
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

  async findTemplatesByUser(userId: string, status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED' | 'DRAFT') {
    const whereCondition: any = {
      createdBy: userId
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
    status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED', 
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
      status?: 'DRAFT' | 'PENDING'
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
            status: templateData.status || 'DRAFT', // Use provided status or default to DRAFT
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

  /**
   * Get template with creator information for email notifications
   */
  async getTemplateWithCreator(templateId: string) {
    return await this.prismaService.templateForm.findUnique({
      where: { id: templateId },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  /**
   * Get user by ID for reviewer information
   */
  async getUserById(userId: string) {
    return await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    })
  }

  /**
   * Update a REJECTED template by recreating it with preserved metadata
   * This replaces all sections and fields while keeping original creation info
   */
  async updateRejectedTemplate(
    templateId: string,
    templateData: CreateTemplateFormDto,
    updatedByUserId: string,
    templateSchema?: any
  ) {
    return this.prismaService.$transaction(
      async (tx) => {
        // 1. Get existing template to preserve metadata
        const existingTemplate = await tx.templateForm.findUnique({
          where: { id: templateId },
          select: {
            id: true,
            version: true,
            status: true,
            createdByUserId: true,
            createdAt: true,
            reviewedByUserId: true,
            reviewedAt: true,
            referFirstVersionId: true
          }
        })

        if (!existingTemplate) {
          throw new TemplateNotFoundError(templateId)
        }

        // Check if template status is REJECTED
        if (existingTemplate.status !== 'REJECTED') {
          throw new InvalidTemplateStatusForUpdateError(existingTemplate.status)
        }

        // 2. Check if template is being used in assessments
        const assessmentCount = await tx.assessmentForm.count({
          where: { templateId }
        })

        if (assessmentCount > 0) {
          throw new TemplateInUseCannotUpdateError()
        }

        // 3. Delete existing sections and fields (cascade delete should handle fields)
        await tx.templateSection.deleteMany({
          where: { templateId }
        })

        // 3. Update template form with new data but preserve metadata
        const updatedTemplateForm = await tx.templateForm.update({
          where: { id: templateId },
          data: {
            name: templateData.name,
            description: templateData.description,
            departmentId: templateData.departmentId || undefined,
            updatedByUserId,
            status: 'PENDING', // Reset to PENDING for re-review
            templateContent: templateData.templateContent || '',
            templateConfig: templateData.templateConfig,
            templateSchema: templateSchema || null,
            // Preserve these fields from existing template
            version: existingTemplate.version,
            createdByUserId: existingTemplate.createdByUserId,
            createdAt: existingTemplate.createdAt,
            referFirstVersionId: existingTemplate.referFirstVersionId,
            // Reset review fields since template is updated
            reviewedByUserId: null,
            reviewedAt: null
          }
        })

        // 4. Create new sections (batch operation)
        const sectionsToCreate = templateData.sections.map((sectionData) => ({
          templateId: updatedTemplateForm.id,
          label: sectionData.label,
          displayOrder: sectionData.displayOrder,
          editBy: sectionData.editBy,
          roleInSubject: sectionData.roleInSubject,
          isSubmittable: sectionData.isSubmittable || false,
          isToggleDependent: sectionData.isToggleDependent || false
        }))

        const createdSections = await tx.templateSection.createManyAndReturn({
          data: sectionsToCreate,
          select: {
            id: true,
            templateId: true,
            label: true,
            displayOrder: true,
            editBy: true,
            roleInSubject: true,
            isSubmittable: true,
            isToggleDependent: true
          }
        })

        // 5. Prepare fields data for batch creation
        const allFieldsData: any[] = []
        const sectionIdMap = new Map<number, string>()

        // Create section mapping by display order
        createdSections.forEach(section => {
          const originalSection = templateData.sections.find(s => s.displayOrder === section.displayOrder)
          if (originalSection) {
            sectionIdMap.set(section.displayOrder, section.id)
          }
        })

        // Build all fields data
        templateData.sections.forEach((sectionData) => {
          const sectionId = sectionIdMap.get(sectionData.displayOrder)
          if (!sectionId || !sectionData.fields) return

          sectionData.fields.forEach((fieldData) => {
            // Handle parent-child relationships
            let parentId: string | null = null
            if (fieldData.parentTempId) {
              // Find parent field within the same section by tempId or fieldName
              const parentField = sectionData.fields.find(f => 
                f.tempId === fieldData.parentTempId || 
                f.fieldName === fieldData.parentTempId
              )
              if (parentField) {
                // We'll need to update this after parent is created
                // For now, mark it for later processing
                parentId = fieldData.parentTempId
              }
            }

            allFieldsData.push({
              sectionId,
              label: fieldData.label || fieldData.fieldName,
              fieldName: fieldData.fieldName,
              fieldType: fieldData.fieldType,
              roleRequired: fieldData.roleRequired,
              options: fieldData.options || null,
              displayOrder: fieldData.displayOrder,
              createdById: existingTemplate.createdByUserId, // Preserve original creator
              parentTempId: parentId // Temporary storage
            })
          })
        })

        // 6. Create fields in batches, handling parent-child relationships
        const createdFieldsMap = new Map<string, string>() // tempId -> actual field id
        const fieldsToUpdateParent: { fieldId: string; parentTempId: string }[] = []

        // First pass: create all fields
        for (const fieldData of allFieldsData) {
          const createdField = await tx.templateField.create({
            data: {
              sectionId: fieldData.sectionId,
              label: fieldData.label,
              fieldName: fieldData.fieldName,
              fieldType: fieldData.fieldType,
              roleRequired: fieldData.roleRequired,
              options: fieldData.options,
              displayOrder: fieldData.displayOrder,
              createdById: fieldData.createdById,
              parentId: null // Set to null initially
            }
          })

          // Map fieldName to actual ID for parent resolution
          createdFieldsMap.set(fieldData.fieldName, createdField.id)
          
          // If this field has a parent, queue it for update
          if (fieldData.parentTempId) {
            fieldsToUpdateParent.push({
              fieldId: createdField.id,
              parentTempId: fieldData.parentTempId
            })
          }
        }

        // Second pass: update parent relationships
        for (const { fieldId, parentTempId } of fieldsToUpdateParent) {
          const parentFieldId = createdFieldsMap.get(parentTempId)
          if (parentFieldId) {
            await tx.templateField.update({
              where: { id: fieldId },
              data: { parentId: parentFieldId }
            })
          }
        }

        // 7. Return updated template with sections and fields
        return await tx.templateForm.findUnique({
          where: { id: templateId },
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
            sections: {
              select: {
                id: true,
                templateId: true,
                label: true,
                displayOrder: true,
                editBy: true,
                roleInSubject: true,
                isSubmittable: true,
                isToggleDependent: true,
                fields: {
                  select: {
                    id: true,
                    sectionId: true,
                    label: true,
                    fieldName: true,
                    fieldType: true,
                    roleRequired: true,
                    options: true,
                    displayOrder: true,
                    parentId: true
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
      },
      {
        maxWait: 15000,
        timeout: 30000
      }
    )
  }

  /**
   * Update a draft template by recreating it with new data while preserving metadata
   */
  async updateDraftTemplate(
    templateId: string,
    templateData: CreateTemplateFormDto,
    updatedByUserId: string,
    templateSchema?: any
  ) {
    return this.prismaService.$transaction(
      async (tx) => {
        // 1. Get existing template to preserve metadata
        const existingTemplate = await tx.templateForm.findUnique({
          where: { id: templateId },
          select: {
            id: true,
            version: true,
            status: true,
            createdByUserId: true,
            createdAt: true,
            reviewedByUserId: true,
            reviewedAt: true,
            referFirstVersionId: true
          }
        })

        if (!existingTemplate) {
          throw new TemplateNotFoundError(templateId)
        }

        // Check if template status is DRAFT
        if (existingTemplate.status !== 'DRAFT') {
          throw new InvalidDraftTemplateStatusError(existingTemplate.status)
        }

        // 2. Check if template is being used in assessments
        const assessmentCount = await tx.assessmentForm.count({
          where: { templateId }
        })

        if (assessmentCount > 0) {
          throw new TemplateInUseCannotUpdateError()
        }

        // 3. Delete existing sections and fields (cascade delete should handle fields)
        await tx.templateSection.deleteMany({
          where: { templateId }
        })

        // 4. Update template form with new data but preserve metadata
        const updatedTemplateForm = await tx.templateForm.update({
          where: { id: templateId },
          data: {
            name: templateData.name,
            description: templateData.description,
            departmentId: templateData.departmentId || undefined,
            updatedByUserId,
            status: templateData.status || 'DRAFT', // Keep as DRAFT or set to PENDING if specified
            templateContent: templateData.templateContent || '',
            templateConfig: templateData.templateConfig,
            templateSchema: templateSchema || null,
            // Preserve these fields from existing template
            version: existingTemplate.version,
            createdByUserId: existingTemplate.createdByUserId,
            createdAt: existingTemplate.createdAt,
            referFirstVersionId: existingTemplate.referFirstVersionId,
            // Only reset review fields if changing to PENDING
            reviewedByUserId: templateData.status === 'PENDING' ? null : existingTemplate.reviewedByUserId,
            reviewedAt: templateData.status === 'PENDING' ? null : existingTemplate.reviewedAt
          }
        })

        // 5. Create new sections (batch operation)
        const sectionsToCreate = templateData.sections.map((sectionData) => ({
          templateId: updatedTemplateForm.id,
          label: sectionData.label,
          displayOrder: sectionData.displayOrder,
          editBy: sectionData.editBy,
          roleInSubject: sectionData.roleInSubject,
          isSubmittable: sectionData.isSubmittable || false,
          isToggleDependent: sectionData.isToggleDependent || false
        }))

        const createdSections = await tx.templateSection.createManyAndReturn({
          data: sectionsToCreate,
          select: {
            id: true,
            templateId: true,
            label: true,
            displayOrder: true,
            editBy: true,
            roleInSubject: true,
            isSubmittable: true,
            isToggleDependent: true
          }
        })

        // 6. Prepare fields data for batch creation
        const allFieldsData: any[] = []
        const sectionIdMap = new Map<number, string>()

        // Create section mapping by display order
        createdSections.forEach(section => {
          const originalSection = templateData.sections.find(s => s.displayOrder === section.displayOrder)
          if (originalSection) {
            sectionIdMap.set(section.displayOrder, section.id)
          }
        })

        // Build all fields data
        templateData.sections.forEach((sectionData) => {
          const sectionId = sectionIdMap.get(sectionData.displayOrder)
          if (!sectionId || !sectionData.fields) return

          sectionData.fields.forEach((fieldData) => {
            allFieldsData.push({
              sectionId,
              label: fieldData.label,
              fieldName: fieldData.fieldName,
              fieldType: fieldData.fieldType,
              roleRequired: fieldData.roleRequired || null,
              options: fieldData.options || null,
              displayOrder: fieldData.displayOrder,
              createdById: updatedByUserId,
              tempId: fieldData.tempId, // Store tempId for mapping
              parentTempId: fieldData.parentTempId || null // Store original parentTempId
            })
          })
        })

        // 7. Create fields in batches, handling parent-child relationships
        const createdFieldsMap = new Map<string, string>() // tempId -> actual field id
        const fieldsToUpdateParent: { fieldId: string; parentTempId: string }[] = []

        // First pass: create all fields
        for (const fieldData of allFieldsData) {
          const createdField = await tx.templateField.create({
            data: {
              sectionId: fieldData.sectionId,
              label: fieldData.label,
              fieldName: fieldData.fieldName,
              fieldType: fieldData.fieldType,
              roleRequired: fieldData.roleRequired,
              options: fieldData.options,
              displayOrder: fieldData.displayOrder,
              createdById: fieldData.createdById,
              parentId: null // Set to null initially
            }
          })

          // Map tempId to actual ID for parent resolution (if tempId exists)
          if (fieldData.tempId) {
            createdFieldsMap.set(fieldData.tempId, createdField.id)
          }
          
          // If this field has a parent, queue it for update
          if (fieldData.parentTempId) {
            fieldsToUpdateParent.push({
              fieldId: createdField.id,
              parentTempId: fieldData.parentTempId
            })
          }
        }

        // Second pass: update parent relationships
        for (const { fieldId, parentTempId } of fieldsToUpdateParent) {
          const parentFieldId = createdFieldsMap.get(parentTempId)
          if (parentFieldId) {
            await tx.templateField.update({
              where: { id: fieldId },
              data: { parentId: parentFieldId }
            })
          }
        }

        // 8. Return updated template with sections and fields
        return await tx.templateForm.findUnique({
          where: { id: templateId },
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
            sections: {
              select: {
                id: true,
                templateId: true,
                label: true,
                displayOrder: true,
                editBy: true,
                roleInSubject: true,
                isSubmittable: true,
                isToggleDependent: true,
                fields: {
                  select: {
                    id: true,
                    sectionId: true,
                    label: true,
                    fieldName: true,
                    fieldType: true,
                    roleRequired: true,
                    options: true,
                    displayOrder: true,
                    parentId: true
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
      },
      {
        maxWait: 15000,
        timeout: 30000
      }
    )
  }

  /**
   * Delete a DRAFT template permanently
   * Only DRAFT templates can be deleted completely
   */
  async deleteDraftTemplate(templateId: string): Promise<void> {
    return await this.prismaService.$transaction(
      async (tx) => {
        // First verify template exists and is DRAFT
        const template = await tx.templateForm.findUnique({
          where: { id: templateId },
          select: { 
            id: true, 
            status: true,
            name: true
          }
        })

        if (!template) {
          throw new TemplateNotFoundError(templateId)
        }

        if (template.status !== 'DRAFT') {
          throw new InvalidDraftTemplateStatusError(template.status)
        }

        // Check if template is being used in assessments
        const assessmentCount = await tx.assessmentForm.count({
          where: { templateId }
        })

        if (assessmentCount > 0) {
          throw new Error(`Cannot delete template '${template.name}' because it is being used in ${assessmentCount} assessment(s)`)
        }

        // Delete template - cascade will handle sections and fields
        await tx.templateForm.delete({
          where: { id: templateId }
        })
      },
      {
        maxWait: 15000,
        timeout: 30000
      }
    )
  }
}

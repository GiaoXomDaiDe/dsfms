import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import { CreateTemplateFormDto } from './template.dto'

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

        // 3. Create all fields (optimized batch processing)
        const allFieldsToCreate = []
        const sectionFieldMapping = new Map<number, any[]>()

        // Prepare all fields for batch creation
        for (let sectionIndex = 0; sectionIndex < templateData.sections.length; sectionIndex++) {
          const sectionData = templateData.sections[sectionIndex]
          const section = createdSections[sectionIndex]

          // Validate field hierarchy before processing
          this.validateFieldHierarchy(sectionData.fields)

          // Since your current data doesn't use parentTempId, we can create all fields directly
          const fieldsForSection = sectionData.fields.map((fieldData) => ({
            sectionId: section.id,
            label: fieldData.label,
            fieldName: fieldData.fieldName,
            fieldType: fieldData.fieldType,
            roleRequired: fieldData.roleRequired,
            options: fieldData.options,
            displayOrder: fieldData.displayOrder,
            parentId: null, // No hierarchy in current data
            createdById: createdByUserId
          }))

          sectionFieldMapping.set(sectionIndex, fieldsForSection)
          allFieldsToCreate.push(...fieldsForSection)
        }

        // Create all fields in smaller batches to avoid transaction timeout
        const batchSize = 20 // Process 20 fields at a time
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

  async updateTemplateStatus(id: string, status: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED', updatedByUserId: string) {
    return this.prismaService.templateForm.update({
      where: { id },
      data: { 
        status,
        updatedByUserId,
        updatedAt: new Date()
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
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '~/shared/services/prisma.service';
import { CreateTemplateFormDto } from './template.dto';

@Injectable()
export class TemplateRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Validate parent-child field relationships before creating
   * @throws Error if validation fails
   */
  private validateFieldHierarchy(fields: any[]): void {
    const fieldNames = new Set(fields.map(f => f.fieldName));
    
    for (const field of fields) {
      if (field.parentTempId) {
        // Extract parent field name from parentTempId (format: "field_{fieldName}")
        const parentFieldName = field.parentTempId.replace(/^field_/, '');
        
        // Check if parent exists in the same section
        if (!fieldNames.has(parentFieldName)) {
          throw new Error(
            `Field '${field.fieldName}' references parent '${parentFieldName}' which does not exist in the same section`
          );
        }
      }
    }

    // Check for self-reference
    for (const field of fields) {
      if (field.parentTempId === `field_${field.fieldName}`) {
        throw new Error(
          `Field '${field.fieldName}' cannot be its own parent`
        );
      }
    }

    // Detect cycles using DFS
    const buildAdjList = () => {
      const adjList = new Map<string, string[]>();
      for (const field of fields) {
        if (!adjList.has(field.fieldName)) {
          adjList.set(field.fieldName, []);
        }
        if (field.parentTempId) {
          const parentName = field.parentTempId.replace(/^field_/, '');
          if (!adjList.has(parentName)) {
            adjList.set(parentName, []);
          }
          adjList.get(parentName)!.push(field.fieldName);
        }
      }
      return adjList;
    };

    const hasCycle = (adjList: Map<string, string[]>) => {
      const visited = new Set<string>();
      const recStack = new Set<string>();

      const dfs = (node: string): boolean => {
        visited.add(node);
        recStack.add(node);

        const neighbors = adjList.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (dfs(neighbor)) return true;
          } else if (recStack.has(neighbor)) {
            return true; // Cycle detected
          }
        }

        recStack.delete(node);
        return false;
      };

      for (const node of adjList.keys()) {
        if (!visited.has(node)) {
          if (dfs(node)) return true;
        }
      }
      return false;
    };

    const adjList = buildAdjList();
    if (hasCycle(adjList)) {
      throw new Error(
        'Circular reference detected in field hierarchy. ' +
        'Fields cannot form a cycle through parent-child relationships.'
      );
    }
  }

  async createTemplateWithSectionsAndFields(
    templateData: CreateTemplateFormDto,
    createdByUserId: string,
    templateSchema?: any
  ) {
    return this.prismaService.$transaction(async (tx) => {
      // 1. Create Template Form
      const templateForm = await tx.templateForm.create({
        data: {
          name: templateData.name,
          description: templateData.description,
          version: 1,
          departmentId: templateData.departmentId,
          createdByUserId,
          isActive: true,
          templateContent: 'test later', // As requested
          templateSchema: templateSchema || null,
        },
      });

      // 2. Create Template Sections with Fields
      const createdSections = [];
      
      for (const sectionData of templateData.sections) {
        // Validate field hierarchy before processing
        this.validateFieldHierarchy(sectionData.fields);

        // Create section
        const section = await tx.templateSection.create({
          data: {
            templateId: templateForm.id,
            label: sectionData.label,
            displayOrder: sectionData.displayOrder,
            editBy: sectionData.editBy,
            roleInSubject: sectionData.roleInSubject,
            isSubmittable: sectionData.isSubmittable || false,
            isToggleDependent: sectionData.isToggleDependent || false,
          },
        });

        // Track field temp IDs to real IDs mapping for hierarchy
        const fieldIdMapping = new Map<string, string>();
        const fieldsToCreate = [...sectionData.fields];
        const createdFields = [];

        // Process fields in order, handling hierarchy
        let maxIterations = fieldsToCreate.length + 1; // Prevent infinite loops
        let iterations = 0;

        while (fieldsToCreate.length > 0) {
          iterations++;
          
          // Safety check to prevent infinite loops
          if (iterations > maxIterations) {
            throw new Error(
              `Failed to create fields after ${maxIterations} iterations. ` +
              `Remaining fields: ${fieldsToCreate.map(f => f.fieldName).join(', ')}`
            );
          }

          const fieldsToProcess = fieldsToCreate.filter(field => {
            // If field has no parent OR parent already created
            return !field.parentTempId || fieldIdMapping.has(field.parentTempId);
          });

          if (fieldsToProcess.length === 0) {
            // Provide detailed error message
            const orphanFields = fieldsToCreate.map(f => ({
              fieldName: f.fieldName,
              parentTempId: f.parentTempId
            }));
            throw new Error(
              `Circular reference or missing parent detected in field hierarchy. ` +
              `Cannot resolve: ${JSON.stringify(orphanFields)}`
            );
          }

          for (const fieldData of fieldsToProcess) {
            const field = await tx.templateField.create({
              data: {
                sectionId: section.id,
                label: fieldData.label,
                fieldName: fieldData.fieldName,
                fieldType: fieldData.fieldType,
                roleRequired: fieldData.roleRequired,
                options: fieldData.options,
                displayOrder: fieldData.displayOrder,
                parentId: fieldData.parentTempId 
                  ? fieldIdMapping.get(fieldData.parentTempId) 
                  : null,
                createdById: createdByUserId,
              },
            });

            // Map temp ID to real ID for future references
            fieldIdMapping.set(`field_${fieldData.fieldName}`, field.id);
            createdFields.push(field);
            
            // Remove processed field
            const index = fieldsToCreate.indexOf(fieldData);
            fieldsToCreate.splice(index, 1);
          }
        }

        createdSections.push({
          ...section,
          fields: createdFields,
        });
      }

      return {
        templateForm,
        sections: createdSections,
      };
    });
  }

  async findTemplateById(id: string) {
    return this.prismaService.templateForm.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
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
                    lastName: true,
                  },
                },
              },
              orderBy: {
                displayOrder: 'asc',
              },
            },
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
    });
  }

  async findAllTemplates() {
    return this.prismaService.templateForm.findMany({
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            sections: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findTemplatesByDepartment(departmentId: string) {
    return this.prismaService.templateForm.findMany({
      where: {
        departmentId,
        isActive: true,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            sections: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateTemplateStatus(id: string, isActive: boolean) {
    return this.prismaService.templateForm.update({
      where: { id },
      data: { isActive },
    });
  }

  async templateExists(id: string): Promise<boolean> {
    const template = await this.prismaService.templateForm.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!template;
  }

  async validateDepartmentExists(departmentId: string): Promise<boolean> {
    const department = await this.prismaService.department.findUnique({
      where: { 
        id: departmentId,
        deletedAt: null,
        isActive: 'ACTIVE'
      },
      select: { id: true },
    });
    return !!department;
  }
}
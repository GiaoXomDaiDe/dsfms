import { Injectable } from '@nestjs/common';
import { PrismaService } from '~/shared/services/prisma.service';
import { CreateTemplateFormDto } from './template.dto';

@Injectable()
export class TemplateRepository {
  constructor(private readonly prismaService: PrismaService) {}

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
        while (fieldsToCreate.length > 0) {
          const fieldsToProcess = fieldsToCreate.filter(field => {
            // If field has no parent OR parent already created
            return !field.parentTempId || fieldIdMapping.has(field.parentTempId);
          });

          if (fieldsToProcess.length === 0) {
            throw new Error('Circular reference detected in field hierarchy');
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
}
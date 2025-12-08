import { Injectable } from '@nestjs/common'
import { GlobalField, FieldType, Prisma } from '@prisma/client'
import { PrismaService } from '~/shared/services/prisma.service'
import { CreateGlobalFieldDto, UpdateGlobalFieldDto } from '~/routes/global-field/global-field.dto'

@Injectable()
export class GlobalFieldRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll() {
    return this.prismaService.globalField.findMany({
      where: {
        parentId: null // Only top-level fields
      },
      select: {
        id: true,
        label: true,
        fieldName: true,
        fieldType: true,
        roleRequired: true,
        children: {
          select: {
            id: true,
            label: true,
            fieldName: true,
            fieldType: true,
            roleRequired: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async findAllDetail() {
    return this.prismaService.globalField.findMany({
      where: {
        parentId: null // Only top-level fields
      },
      include: {
        children: {
          include: {
            children: {
              select: {
                id: true,
                label: true,
                fieldName: true,
                fieldType: true,
                roleRequired: true,
                options: true,
                createdAt: true,
                updatedAt: true,
                createdBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                },
                updatedBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              },
              orderBy: {
                createdAt: 'asc'
              }
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
            updatedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async findById(id: string) {
    return this.prismaService.globalField.findUnique({
      where: { id },
      select: {
        id: true,
        label: true,
        fieldName: true,
        fieldType: true,
        roleRequired: true,
        options: true,
        parentId: true,
        children: {
          select: {
            id: true,
            label: true,
            fieldName: true,
            fieldType: true,
            roleRequired: true,
            options: true,
            children: {
              select: {
                id: true,
                label: true,
                fieldName: true,
                fieldType: true,
                roleRequired: true,
                options: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })
  }

  async findByIdDetail(id: string) {
    return this.prismaService.globalField.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            label: true,
            fieldName: true,
            fieldType: true
          }
        },
        children: {
          include: {
            children: {
              select: {
                id: true,
                label: true,
                fieldName: true,
                fieldType: true,
                roleRequired: true,
                options: true,
                createdAt: true,
                updatedAt: true,
                createdBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                },
                updatedBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              },
              orderBy: {
                createdAt: 'asc'
              }
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
            updatedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })
  }

  async create(data: CreateGlobalFieldDto, createdById?: string) {
    const { tempId, children, displayOrder, ...fieldData } = data
    return this.prismaService.globalField.create({
      data: {
        ...fieldData,
        createdById
      },
      include: {
        parent: {
          select: {
            id: true,
            label: true,
            fieldName: true
          }
        },
        children: {
          select: {
            id: true,
            label: true,
            fieldName: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })
  }

  async createFieldWithChildren(data: CreateGlobalFieldDto, createdById?: string) {
    return this.prismaService.$transaction(
      async (tx) => {
        // 1. Create the parent field first
        const parentField = await tx.globalField.create({
          data: {
            label: data.label,
            fieldName: data.fieldName,
            fieldType: data.fieldType,
            roleRequired: data.roleRequired,
            options: data.options,
            parentId: data.parentId,
            createdById
          }
        })

        // 2. Create child fields if they exist
        const createdChildren = []
        if (data.children && data.children.length > 0) {
          // Create mapping for tempId to actual field
          const tempIdToFieldMap = new Map<string, any>()
          tempIdToFieldMap.set(data.tempId || 'parent', parentField)

          // Flatten all fields to process them in proper order
          const allFields = this.flattenFieldHierarchy(data.children)

          // Process fields level by level to maintain parent-child relationships
          for (const fieldData of allFields) {
            // Find the parent field using tempId mapping
            let parentFieldRef = parentField
            if (fieldData.parentTempId) {
              parentFieldRef = tempIdToFieldMap.get(fieldData.parentTempId)
              if (!parentFieldRef) {
                throw new Error(
                  `Parent field with tempId '${fieldData.parentTempId}' not found for field '${fieldData.fieldName}'`
                )
              }
            }

            // Check if child fieldName already exists
            const existingChildField = await tx.globalField.findFirst({
              where: { fieldName: fieldData.fieldName }
            })
            if (existingChildField) {
              throw new Error(`Field name '${fieldData.fieldName}' already exists`)
            }

            const childField = await tx.globalField.create({
              data: {
                label: fieldData.label,
                fieldName: fieldData.fieldName,
                fieldType: 'TEXT', // Always TEXT for children fields
                roleRequired: fieldData.roleRequired,
                options: fieldData.options,
                parentId: parentFieldRef.id,
                createdById
              }
            })
            createdChildren.push(childField)

            // Map tempId to actual field for further child field references
            if (fieldData.tempId) {
              tempIdToFieldMap.set(fieldData.tempId, childField)
            }
          }
        }

        // 3. Return the parent field with its children
        return {
          ...parentField,
          children: createdChildren
        }
      },
      {
        timeout: 30000 // Increase timeout to 30 seconds
      }
    )
  }

  private flattenFieldHierarchy(fields: any[]): any[] {
    const flattened: any[] = []
    
    // Process fields level by level to maintain proper parent-child order
    const queue = [...fields]
    
    while (queue.length > 0) {
      const current = queue.shift()!
      flattened.push(current)
      
      if (current.children && current.children.length > 0) {
        // Add children to queue for next level processing
        queue.push(...current.children.map((child: any) => ({
          ...child,
          parentTempId: current.tempId || current.parentTempId
        })))
      }
    }
    
    return flattened
  }

  async update(id: string, data: UpdateGlobalFieldDto, updatedById?: string) {
    const { tempId, children, ...updateData } = data
    return this.prismaService.globalField.update({
      where: { id },
      data: {
        ...updateData,
        updatedById
      },
      include: {
        parent: {
          select: {
            id: true,
            label: true,
            fieldName: true
          }
        },
        children: {
          select: {
            id: true,
            label: true,
            fieldName: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })
  }

  async updateFieldWithChildren(id: string, data: UpdateGlobalFieldDto, updatedById?: string) {
    return this.prismaService.$transaction(
      async (tx) => {
        // 1. Update the parent field first
        const { tempId, children, ...parentUpdateData } = data
        const updatedParent = await tx.globalField.update({
          where: { id },
          data: {
            ...parentUpdateData,
            updatedById
          }
        })

        // 2. Handle children updates if provided
        if (children && children.length > 0) {
          // Get existing children
          const existingChildren = await tx.globalField.findMany({
            where: { parentId: id },
            select: { id: true, fieldName: true }
          })

          // Create mapping for tempId to actual field for new children
          const tempIdToFieldMap = new Map<string, any>()
          tempIdToFieldMap.set(data.tempId || 'parent', updatedParent)

          // Process children updates
          for (const childData of children) {
            if (childData._delete && childData.id) {
              // Delete existing child
              await tx.globalField.delete({
                where: { id: childData.id }
              })
            } else if (childData.id) {
              // Update existing child
              await tx.globalField.update({
                where: { id: childData.id },
                data: {
                  label: childData.label,
                  fieldName: childData.fieldName,
                  roleRequired: childData.roleRequired,
                  options: childData.options,
                  updatedById
                }
              })
            } else if (childData.fieldName && childData.label) {
              // Create new child
              // Check if child fieldName already exists
              const existingChildField = await tx.globalField.findFirst({
                where: { fieldName: childData.fieldName }
              })
              if (existingChildField) {
                throw new Error(`Child field name '${childData.fieldName}' already exists`)
              }

              const newChild = await tx.globalField.create({
                data: {
                  label: childData.label,
                  fieldName: childData.fieldName,
                  fieldType: 'TEXT', // Always TEXT for children
                  roleRequired: childData.roleRequired,
                  options: childData.options,
                  parentId: id,
                  createdById: updatedById
                }
              })

              // Map tempId for nested children
              if (childData.tempId) {
                tempIdToFieldMap.set(childData.tempId, newChild)
              }
            }
          }
        }

        // 3. Return updated parent with current children
        return await tx.globalField.findUnique({
          where: { id },
          include: {
            children: {
              select: {
                id: true,
                label: true,
                fieldName: true,
                fieldType: true,
                roleRequired: true,
                options: true,
                createdAt: true,
                updatedAt: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
            updatedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        })
      },
      {
        timeout: 30000
      }
    )
  }

  async delete(id: string) {
    return this.prismaService.globalField.delete({
      where: { id }
    })
  }

  async findByFieldName(fieldName: string) {
    return this.prismaService.globalField.findFirst({
      where: { fieldName },
      select: {
        id: true,
        fieldName: true
      }
    })
  }

  async fieldNameExists(fieldName: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.GlobalFieldWhereInput = {
      fieldName
    }

    if (excludeId) {
      where.id = {
        not: excludeId
      }
    }

    const field = await this.prismaService.globalField.findFirst({
      where,
      select: { id: true }
    })
    return !!field
  }

  async exists(id: string): Promise<boolean> {
    const field = await this.prismaService.globalField.findUnique({
      where: { id },
      select: { id: true }
    })
    return !!field
  }

  async checkCircularReference(id: string, parentId: string): Promise<boolean> {
    // Check if parentId is a descendant of id
    const checkDescendant = async (currentId: string, targetId: string): Promise<boolean> => {
      if (currentId === targetId) {
        return true
      }

      const children = await this.prismaService.globalField.findMany({
        where: { parentId: currentId },
        select: { id: true }
      })

      for (const child of children) {
        if (await checkDescendant(child.id, targetId)) {
          return true
        }
      }
      return false
    }

    return checkDescendant(id, parentId)
  }
}

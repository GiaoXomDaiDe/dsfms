import { Injectable } from '@nestjs/common'
import { GlobalField, FieldType, Prisma } from '@prisma/client'
import { PrismaService } from '~/shared/services/prisma.service'
import { CreateGlobalFieldDto, UpdateGlobalFieldDto } from '~/routes/global-field/global-field.dto'

@Injectable()
export class GlobalFieldRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll() {
    return this.prismaService.globalField.findMany({
      select: {
        id: true,
        label: true,
        fieldName: true,
        roleRequired: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async findAllDetail() {
    return this.prismaService.globalField.findMany({
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
        options: true
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

  async create(data: CreateGlobalFieldDto, createdById?: string) {
    return this.prismaService.globalField.create({
      data: {
        ...data,
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

  async update(id: string, data: UpdateGlobalFieldDto, updatedById?: string) {
    return this.prismaService.globalField.update({
      where: { id },
      data: {
        ...data,
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

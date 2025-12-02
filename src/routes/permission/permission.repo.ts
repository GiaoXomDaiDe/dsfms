import { Injectable } from '@nestjs/common'
import {
  CreatePermissionBodyType,
  GetPermissionsResType,
  PermissionType,
  UpdatePermissionBodyType
} from '~/routes/permission/permission.model'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class PermissionRepo {
  constructor(private readonly prisma: PrismaService) {}
  async list(): Promise<GetPermissionsResType> {
    const permissions = await this.prisma.endpointPermission.findMany()

    return {
      permissions,
      totalItems: permissions.length
    }
  }

  findById(id: string): Promise<PermissionType | null> {
    return this.prisma.endpointPermission.findFirst({
      where: {
        id
      }
    })
  }

  async create({
    data,
    createdById
  }: {
    data: CreatePermissionBodyType
    createdById: string | null
  }): Promise<PermissionType> {
    return await this.prisma.endpointPermission.create({
      data: {
        ...data,
        createdById,
        createdAt: new Date()
      }
    })
  }

  async update({ id, updatedById, data }: { id: string; updatedById: string; data: UpdatePermissionBodyType }) {
    return await this.prisma.endpointPermission.update({
      where: {
        id,
        deletedAt: null,
        isActive: true
      },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      }
    })
  }

  delete(
    {
      id,
      deletedById
    }: {
      id: string
      deletedById: string
    },
    isHard?: boolean
  ): Promise<PermissionType> {
    return isHard
      ? this.prisma.endpointPermission.delete({
          where: {
            id
          }
        })
      : this.prisma.endpointPermission.update({
          where: {
            id,
            deletedAt: null,
            isActive: true
          },
          data: {
            deletedAt: new Date(),
            deletedById,
            isActive: false
          }
        })
  }

  enable({ id, enabledById }: { id: string; enabledById: string }): Promise<PermissionType> {
    return this.prisma.endpointPermission.update({
      where: {
        id,
        deletedAt: { not: null },
        isActive: false
      },
      data: {
        deletedAt: null,
        deletedById: null,
        isActive: true,
        updatedById: enabledById,
        updatedAt: new Date()
      }
    })
  }
}

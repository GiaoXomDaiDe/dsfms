import { Injectable } from '@nestjs/common'
import {
  CreatePermissionBodyType,
  PermissionType,
  UpdatePermissionBodyType
} from '~/routes/permission/permission.model'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class PermissionRepo {
  constructor(private readonly prisma: PrismaService) {}
  async list() {
    const [totalItems, data] = await Promise.all([
      this.prisma.permission.count({
        where: {
          deletedAt: null
        }
      }),
      this.prisma.permission.findMany({
        where: {
          deletedAt: null
        }
      })
    ])
    return {
      data,
      totalItems
    }
  }

  async findById(id: string): Promise<PermissionType | null> {
    return this.prisma.permission.findUnique({
      where: {
        id,
        deletedAt: null
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
    return await this.prisma.permission.create({
      data: {
        ...data,
        createdById
      }
    })
  }

  async update({ id, updatedById, data }: { id: string; updatedById: string; data: UpdatePermissionBodyType }) {
    return await this.prisma.permission.update({
      where: {
        id,
        deletedAt: null
      },
      data: {
        ...data,
        updatedById
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
      ? this.prisma.permission.delete({
          where: {
            id
          }
        })
      : this.prisma.permission.update({
          where: {
            id,
            deletedAt: null
          },
          data: {
            deletedAt: new Date(),
            deletedById
          }
        })
  }
}

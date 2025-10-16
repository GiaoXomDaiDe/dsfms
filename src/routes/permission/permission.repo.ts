import { Injectable } from '@nestjs/common'
import {
  CreatePermissionBodyType,
  PermissionType,
  UpdatePermissionBodyType
} from '~/routes/permission/permission.model'
import { STATUS_CONST } from '~/shared/constants/auth.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class PermissionRepo {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sharedUserRepository: SharedUserRepository
  ) {}
  async list({ includeDeleted = false }: { includeDeleted?: boolean } = {}) {
    const whereClause = this.sharedUserRepository.buildListFilters({ includeDeleted })

    const [totalItems, data] = await Promise.all([
      this.prisma.permission.count({
        where: whereClause
      }),
      this.prisma.permission.findMany({
        where: whereClause
      })
    ])
    return {
      data,
      totalItems
    }
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<PermissionType | null> {
    const whereClause = includeDeleted ? { id } : { id, deletedAt: null }

    return this.prisma.permission.findUnique({
      where: whereClause
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
            deletedById,
            isActive: STATUS_CONST.INACTIVE
          }
        })
  }

  async enable({ id, enabledById }: { id: string; enabledById: string }): Promise<PermissionType> {
    return this.prisma.permission.update({
      where: {
        id,
        deletedAt: { not: null }
      },
      data: {
        deletedAt: null,
        deletedById: null,
        isActive: STATUS_CONST.ACTIVE,
        updatedById: enabledById
      }
    })
  }
}

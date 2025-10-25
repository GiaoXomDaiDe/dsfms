import { Injectable } from '@nestjs/common'
import {
  CreatePermissionBodyType,
  PermissionModuleType,
  PermissionType,
  UpdatePermissionBodyType
} from '~/routes/permission/permission.model'
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

    const [totalItems, permissions] = await Promise.all([
      this.prisma.permission.count({
        where: whereClause
      }),
      this.prisma.permission.findMany({
        where: whereClause
      })
    ])

    const grouped = permissions.reduce<Array<PermissionModuleType>>((acc, permission) => {
      const rawModuleName = permission.viewModule ?? permission.module ?? ''
      const moduleName = rawModuleName.trim().length > 0 ? rawModuleName : 'Uncategorized'
      const rawPermissionName = permission.viewName ?? permission.name ?? ''
      const permissionName = rawPermissionName.trim().length > 0 ? rawPermissionName : permission.name

      let moduleEntry = acc.find((entry) => entry.module.name === moduleName)
      if (!moduleEntry) {
        moduleEntry = {
          module: {
            name: moduleName,
            listPermissions: []
          }
        }
        acc.push(moduleEntry)
      }

      moduleEntry.module.listPermissions.push({
        permissionId: permission.id,
        name: permissionName
      })

      return acc
    }, [])

    return {
      data: grouped,
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
            isActive: false
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
        isActive: true,
        updatedById: enabledById
      }
    })
  }
}

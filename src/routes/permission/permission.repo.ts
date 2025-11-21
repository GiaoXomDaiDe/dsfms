import { Injectable } from '@nestjs/common'
import {
  CreatePermissionBodyType,
  PermissionModuleType,
  PermissionType,
  UpdatePermissionBodyType
} from '~/routes/permission/permission.model'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class PermissionRepo {
  constructor(private readonly prisma: PrismaService) {}
  async list(options: { excludeModules?: string[] } = {}) {
    const { excludeModules = [] } = options

    const permissions = await this.prisma.permission.findMany()

    const excludedModuleNames = new Set(
      excludeModules
        .filter((moduleName) => typeof moduleName === 'string')
        .filter((moduleName) => moduleName.length > 0)
    )

    const grouped = permissions.reduce<Array<PermissionModuleType>>((acc, permission) => {
      const rawModuleName = permission.viewModule ?? 'Uncategorized'
      const moduleName = rawModuleName.trim().length > 0 ? rawModuleName : 'Uncategorized'

      if (excludedModuleNames.has(moduleName)) return acc

      const rawPermissionName = permission.viewName ?? 'Uncategorized'
      const permissionName = rawPermissionName.trim().length > 0 ? rawPermissionName : 'Uncategorized'

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
        id: permission.id,
        name: permissionName
      })

      return acc
    }, [])
    grouped.sort((a, b) => a.module.name.localeCompare(b.module.name))

    const totalItems = grouped.reduce((sum, item) => sum + item.module.listPermissions.length, 0)

    return {
      modules: grouped,
      totalItems
    }
  }

  async findById(id: string): Promise<PermissionType | null> {
    return this.prisma.permission.findFirst({
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
        deletedAt: null,
        isActive: true
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

  async enable({ id, enabledById }: { id: string; enabledById: string }): Promise<PermissionType> {
    return this.prisma.permission.update({
      where: {
        id,
        deletedAt: { not: null },
        isActive: false
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

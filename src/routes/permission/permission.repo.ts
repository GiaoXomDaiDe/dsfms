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

    const normalizeModuleName = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    const excludedModuleNames = new Set(
      excludeModules
        .filter((moduleName) => typeof moduleName === 'string')
        .map((moduleName) => normalizeModuleName(moduleName))
        .filter((moduleName) => moduleName.length > 0)
    )

    const grouped = permissions.reduce<Array<PermissionModuleType>>((acc, permission) => {
      const rawModuleName = permission.module ?? ''
      const moduleName = rawModuleName.trim().length > 0 ? rawModuleName : 'Uncategorized'
      const normalizedModuleName = normalizeModuleName(moduleName)

      if (excludedModuleNames.has(normalizedModuleName)) return acc

      const rawPermissionName = permission.viewName ?? permission.name ?? ''
      const permissionName = rawPermissionName.trim().length > 0 ? rawPermissionName : permission.name

      let moduleEntry = acc.find((entry) => normalizeModuleName(entry.module.name) === normalizedModuleName)
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
    grouped.sort((a, b) => a.module.name.localeCompare(b.module.name, undefined, { sensitivity: 'base' }))

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

import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { NotFoundRoleException } from '~/routes/role/role.error'
import {
  CreateRoleBodyType,
  GetRolesResType,
  RoleType,
  RoleWithPermissionsType,
  UpdateRoleBodyType
} from '~/routes/role/role.model'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'

const activePermissionFilter = {
  deletedAt: null,
  isActive: true
} satisfies Prisma.EndpointPermissionWhereInput

const roleDetailInclude = {
  permissions: {
    where: activePermissionFilter
  },
  _count: {
    select: {
      users: {
        where: {
          deletedAt: null
        }
      },
      permissions: {
        where: activePermissionFilter
      }
    }
  }
} as const
@Injectable()
@SerializeAll()
export class RoleRepo {
  constructor(private prismaService: PrismaService) {}

  async list(): Promise<GetRolesResType> {
    const rolesWithCount = await this.prismaService.role.findMany({
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    const roles = rolesWithCount.map(({ _count, ...role }) => ({
      ...role,
      userCount: _count.users
    }))
    return {
      roles,
      totalItems: roles.length
    }
  }

  async findById(id: string): Promise<RoleWithPermissionsType | null> {
    const role = await this.prismaService.role.findFirst({
      where: {
        id
      },
      include: roleDetailInclude
    })

    return this.mapRoleWithCounts(role)
  }

  async create({
    createdById,
    data
  }: {
    createdById: string | null
    data: CreateRoleBodyType
  }): Promise<RoleWithPermissionsType> {
    const role = await this.prismaService.role.create({
      data: {
        name: data.name,
        description: data.description,
        permissions: {
          connect: data.permissionIds.map((id) => ({ id }))
        },
        createdById
      },
      include: roleDetailInclude
    })

    return this.mapRoleWithCounts(role)!
  }

  async update({
    id,
    updatedById,
    data
  }: {
    id: string
    updatedById: string
    data: UpdateRoleBodyType
  }): Promise<RoleWithPermissionsType> {
    const role = await this.prismaService.role.update({
      where: {
        id,
        deletedAt: null,
        isActive: true
      },
      data: {
        name: data.name,
        description: data.description,
        permissions: {
          set: data.permissionIds?.map((permissionId) => ({ id: permissionId }))
        },
        updatedById
      },
      include: roleDetailInclude
    })

    return this.mapRoleWithCounts(role)!
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
  ): Promise<RoleType> {
    return isHard
      ? this.prismaService.role.delete({
          where: {
            id
          }
        })
      : this.prismaService.role.update({
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

  async enable({ id, enabledById }: { id: string; enabledById: string }): Promise<void> {
    await this.prismaService.role.update({
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

  async addPermissions({
    roleId,
    permissionIds,
    updatedById
  }: {
    roleId: string
    permissionIds: string[]
    updatedById: string
  }) {
    const currentRole = await this.prismaService.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          where: activePermissionFilter,
          select: { id: true }
        }
      }
    })

    if (!currentRole) {
      throw NotFoundRoleException
    }

    const existingPermissionIds = currentRole.permissions.map((p) => p.id)
    const newPermissionIds = permissionIds.filter((id) => !existingPermissionIds.includes(id))

    if (newPermissionIds.length === 0) {
      return { addedPermissions: [] }
    }

    await this.prismaService.role.update({
      where: { id: roleId },
      data: {
        permissions: {
          connect: newPermissionIds.map((id) => ({ id }))
        },
        updatedById
      }
    })

    const addedPermissions = await this.prismaService.endpointPermission.findMany({
      where: {
        id: { in: newPermissionIds },
        ...activePermissionFilter
      }
    })

    return { addedPermissions }
  }

  async removePermissions({
    roleId,
    permissionIds,
    updatedById
  }: {
    roleId: string
    permissionIds: string[]
    updatedById: string
  }) {
    const currentRole = await this.prismaService.role.findFirst({
      where: { id: roleId },
      include: {
        permissions: {
          where: activePermissionFilter,
          select: { id: true }
        }
      }
    })

    if (!currentRole) {
      throw new Error('Role not found')
    }

    const existingPermissionIds = currentRole.permissions.map((permission) => permission.id)
    const permissionIdsToRemove = permissionIds.filter((id) => existingPermissionIds.includes(id))

    if (permissionIdsToRemove.length === 0) {
      return { removedPermissions: [] }
    }

    await this.prismaService.role.update({
      where: { id: roleId },
      data: {
        permissions: {
          disconnect: permissionIdsToRemove.map((id) => ({ id }))
        },
        updatedById
      }
    })

    const removedPermissions = await this.prismaService.endpointPermission.findMany({
      where: {
        id: { in: permissionIdsToRemove },
        ...activePermissionFilter
      }
    })

    return { removedPermissions }
  }

  private mapRoleWithCounts(
    role: Prisma.RoleGetPayload<{ include: typeof roleDetailInclude }> | null
  ): RoleWithPermissionsType | null {
    if (!role) return null

    const { _count, permissions, ...roleData } = role

    return {
      ...roleData,
      userCount: _count.users,
      permissionCount: _count.permissions
    }
  }
}

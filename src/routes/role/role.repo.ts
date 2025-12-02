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
import {
  activeEndpointPermissionFilter,
  roleDetailInclude,
  roleListWithUserCountInclude
} from '~/shared/prisma-presets/shared-role.prisma-presets'
import { PrismaService } from '~/shared/services/prisma.service'
@Injectable()
@SerializeAll()
export class RoleRepo {
  constructor(private prismaService: PrismaService) {}

  async list(): Promise<GetRolesResType> {
    const rolesWithCount = await this.prismaService.role.findMany({
      include: roleListWithUserCountInclude
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
    data,
    permissionIds
  }: {
    createdById: string | null
    data: CreateRoleBodyType
    permissionIds: string[]
  }): Promise<RoleWithPermissionsType> {
    const role = await this.prismaService.role.create({
      data: {
        name: data.name,
        description: data.description,
        permissions: {
          connect: permissionIds.map((id) => ({ id }))
        },
        createdById,
        createdAt: new Date()
      },
      include: roleDetailInclude
    })

    return this.mapRoleWithCounts(role)!
  }

  async update({
    id,
    updatedById,
    data,
    permissionIds
  }: {
    id: string
    updatedById: string
    data: UpdateRoleBodyType
    permissionIds?: string[]
  }): Promise<RoleWithPermissionsType> {
    let permissionsUpdate: Prisma.RoleUpdateInput['permissions'] | undefined

    if (permissionIds) {
      const currentRole = await this.prismaService.role.findFirst({
        where: {
          id,
          deletedAt: null,
          isActive: true
        },
        select: {
          permissions: {
            select: { id: true }
          }
        }
      })

      if (!currentRole) {
        throw NotFoundRoleException
      }

      const existingPermissionIds = currentRole.permissions.map((permission) => permission.id)
      const existingPermissionIdSet = new Set(existingPermissionIds)
      const desiredPermissionSet = new Set(permissionIds)
      const shouldConnect = (permissionId: string) => !existingPermissionIdSet.has(permissionId)
      const shouldDisconnect = (permissionId: string) => !desiredPermissionSet.has(permissionId)
      const permissionsToConnect = permissionIds.filter(shouldConnect)
      const permissionsToDisconnect = existingPermissionIds.filter(shouldDisconnect)

      if (permissionsToConnect.length > 0 || permissionsToDisconnect.length > 0) {
        permissionsUpdate = {
          ...(permissionsToConnect.length > 0
            ? { connect: permissionsToConnect.map((permissionId) => ({ id: permissionId })) }
            : {}),
          ...(permissionsToDisconnect.length > 0
            ? { disconnect: permissionsToDisconnect.map((permissionId) => ({ id: permissionId })) }
            : {})
        }
      }
    }

    const role = await this.prismaService.role.update({
      where: {
        id,
        deletedAt: null,
        isActive: true
      },
      data: {
        name: data.name,
        description: data.description,
        permissions: permissionsUpdate,
        updatedById,
        updatedAt: new Date()
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
        updatedById: enabledById,
        updatedAt: new Date()
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
          where: activeEndpointPermissionFilter,
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
        ...activeEndpointPermissionFilter
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
          where: activeEndpointPermissionFilter,
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
        ...activeEndpointPermissionFilter
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

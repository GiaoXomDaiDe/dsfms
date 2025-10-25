import { Injectable } from '@nestjs/common'
import {
  CreateRoleBodyType,
  GetRolesResType,
  RoleType,
  RoleWithPermissionsType,
  UpdateRoleBodyType
} from '~/routes/role/role.model'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class RoleRepo {
  constructor(
    private prismaService: PrismaService,
    private readonly sharedUserRepository: SharedUserRepository
  ) {}

  async list({ includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<GetRolesResType> {
    const whereClause = this.sharedUserRepository.buildListFilters({ includeDeleted })

    const [totalItems, rolesWithCount] = await Promise.all([
      this.prismaService.role.count({
        where: whereClause
      }),
      this.prismaService.role.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              users: true
            }
          }
        }
      })
    ])

    const roles = rolesWithCount.map(({ _count, ...role }) => ({
      ...role,
      userCount: _count.users
    }))
    return {
      roles,
      totalItems
    }
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<RoleWithPermissionsType | null> {
    const whereClause = includeDeleted ? { id } : { id, deletedAt: null }

    const role = await this.prismaService.role.findUnique({
      where: whereClause,
      include: {
        permissions: {
          where: {
            deletedAt: null
          }
        },
        _count: {
          select: {
            users: {
              where: {
                deletedAt: null
              }
            },
            permissions: {
              where: {
                deletedAt: null
              }
            }
          }
        }
      }
    })
    if (!role) return null
    const { _count, ...roleData } = role
    return {
      ...roleData,
      userCount: _count.users,
      permissionCount: _count.permissions
    }
  }

  create({ createdById, data }: { createdById: string | null; data: CreateRoleBodyType }): Promise<RoleType> {
    return this.prismaService.role.create({
      data: {
        name: data.name,
        description: data.description,
        permissions: {
          connect: data.permissionIds.map((id) => ({ id }))
        },
        createdById
      },
      include: {
        permissions: {
          where: {
            deletedAt: null
          }
        }
      }
    })
  }

  async update({
    id,
    updatedById,
    data
  }: {
    id: string
    updatedById: string
    data: UpdateRoleBodyType
  }): Promise<RoleType> {
    return this.prismaService.role.update({
      where: {
        id,
        deletedAt: null
      },
      data: {
        name: data.name,
        description: data.description,
        permissions: {
          set: data.permissionIds?.map((id) => ({ id }))
        },
        updatedById
      },
      include: {
        permissions: {
          where: {
            deletedAt: null
          }
        }
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
      where: { id: roleId, deletedAt: null },
      include: {
        permissions: {
          where: { deletedAt: null },
          select: { id: true }
        }
      }
    })

    if (!currentRole) {
      throw new Error('Role not found')
    }

    const existingPermissionIds = currentRole.permissions.map((p) => p.id)
    const newPermissionIds = permissionIds.filter((id) => !existingPermissionIds.includes(id))

    if (newPermissionIds.length === 0) {
      return { addedPermissions: [] }
    }

    await this.prismaService.role.update({
      where: { id: roleId, deletedAt: null },
      data: {
        permissions: {
          connect: newPermissionIds.map((id) => ({ id }))
        },
        updatedById
      }
    })

    const addedPermissions = await this.prismaService.permission.findMany({
      where: {
        id: { in: newPermissionIds },
        deletedAt: null
      }
    })

    return { addedPermissions }
  }
}

import { Injectable } from '@nestjs/common'
import {
  CreateRoleBodyType,
  GetRolesResType,
  RoleType,
  RoleWithPermissionsType,
  UpdateRoleBodyType
} from '~/routes/role/role.model'
import { ActiveStatus } from '~/shared/constants/default.constant'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class RoleRepo {
  constructor(private prismaService: PrismaService) {}

  async list({ includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<GetRolesResType> {
    const whereClause = includeDeleted ? {} : { deletedAt: null }

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
            isActive: ActiveStatus.INACTIVE
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
        isActive: ActiveStatus.ACTIVE,
        updatedById: enabledById
      }
    })
  }
}

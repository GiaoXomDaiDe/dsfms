import { Injectable } from '@nestjs/common'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'

type ActivePermissionGroupMapping = {
  id: string
  permissionGroupCode: string
  groupName: string
  permissions: {
    endpointPermissionId: string
  }[]
}

@Injectable()
@SerializeAll()
export class SharedPermissionGroupRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findByRoleId(roleId: string) {
    return this.prismaService.permissionGroup.findMany({
      where: {
        permissions: {
          some: {
            endpointPermission: {
              roles: {
                some: {
                  id: roleId
                }
              }
            }
          }
        }
      },
      select: {
        id: true,
        groupName: true,
        permissionGroupCode: true,
        name: true
      },
      orderBy: [{ groupName: 'asc' }, { permissionGroupCode: 'asc' }]
    })
  }

  async findRoleActiveEndpointIds(roleId: string): Promise<string[]> {
    const endpoints = await this.prismaService.endpointPermission.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        roles: {
          some: {
            id: roleId
          }
        }
      },
      select: { id: true }
    })

    return endpoints.map((endpoint) => endpoint.id)
  }

  findAllGroupsWithActiveEndpointMappings() {
    return this.prismaService.permissionGroup.findMany({
      include: {
        permissions: {
          where: {
            endpointPermission: {
              deletedAt: null,
              isActive: true
            }
          },
          select: {
            endpointPermissionId: true
          }
        }
      },
      orderBy: [{ groupName: 'asc' }, { permissionGroupCode: 'asc' }]
    })
  }

  findActivePermissionMappingsByCodes(permissionGroupCodes: string[]): Promise<ActivePermissionGroupMapping[]> {
    if (permissionGroupCodes.length === 0) {
      return Promise.resolve<ActivePermissionGroupMapping[]>([])
    }

    return this.prismaService.permissionGroup.findMany({
      where: {
        permissionGroupCode: {
          in: permissionGroupCodes
        }
      },
      select: {
        id: true,
        permissionGroupCode: true,
        groupName: true,
        permissions: {
          where: {
            endpointPermission: {
              deletedAt: null,
              isActive: true
            }
          },
          select: {
            endpointPermissionId: true
          }
        }
      }
    })
  }
}

import { Injectable } from '@nestjs/common'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import {
  permissionGroupActiveEndpointMappingSelect,
  permissionGroupOrderBy,
  permissionGroupSummarySelect
} from '~/shared/prisma-presets/shared-permission-group.prisma-presets'
import { PrismaService } from '~/shared/services/prisma.service'

type ActivePermissionGroupMapping = {
  id: string
  permissionGroupCode: string
  groupName: string
  name: string
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
      select: permissionGroupSummarySelect,
      orderBy: permissionGroupOrderBy
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

  findAllGroupsWithActiveEndpointMappings(): Promise<ActivePermissionGroupMapping[]> {
    return this.prismaService.permissionGroup.findMany({
      select: permissionGroupActiveEndpointMappingSelect,
      orderBy: permissionGroupOrderBy
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
      select: permissionGroupActiveEndpointMappingSelect
    })
  }
}

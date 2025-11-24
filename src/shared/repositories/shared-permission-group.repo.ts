import { Injectable } from '@nestjs/common'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'

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
}

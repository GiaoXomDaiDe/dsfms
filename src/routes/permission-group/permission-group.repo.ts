import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  CreatePermissionGroupBodyType,
  PermissionGroupType,
  UpdatePermissionGroupBodyType
} from './permission-group.model'

@Injectable()
export class PermissionGroupRepo {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreatePermissionGroupBodyType): Promise<PermissionGroupType> {
    return this.prisma.permissionGroup.create({ data })
  }

  list(): Promise<PermissionGroupType[]> {
    return this.prisma.permissionGroup.findMany({
      orderBy: [{ groupName: 'asc' }, { permissionGroupCode: 'asc' }]
    })
  }

  findById(id: string): Promise<PermissionGroupType | null> {
    return this.prisma.permissionGroup.findUnique({ where: { id } })
  }

  update(id: string, data: UpdatePermissionGroupBodyType): Promise<PermissionGroupType> {
    return this.prisma.permissionGroup.update({ where: { id }, data })
  }

  delete(id: string): Promise<PermissionGroupType> {
    return this.prisma.permissionGroup.delete({ where: { id } })
  }

  async replaceEndpointPermissions(permissionGroupId: string, permissionIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.permissionGroupToEndpointPermission.deleteMany({ where: { permissionGroupId } })

      if (permissionIds.length === 0) {
        return
      }

      await tx.permissionGroupToEndpointPermission.createMany({
        data: permissionIds.map((endpointPermissionId) => ({
          permissionGroupId,
          endpointPermissionId
        })),
        skipDuplicates: true
      })
    })
  }
}

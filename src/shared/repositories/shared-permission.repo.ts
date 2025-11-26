import { Injectable } from '@nestjs/common'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { createPermissionNotFoundError } from '~/shared/errors/shared.error'
import { PrismaService } from '~/shared/services/prisma.service'

/**
 * Repository chia sẻ cho các thao tác permission validation
 */
@Injectable()
@SerializeAll()
export class SharedPermissionRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Validate danh sách permission IDs có tồn tại trong database
   * @param ids - Array permission IDs cần validate
   * @throws Error nếu có IDs không tồn tại
   */
  async validatePermissionIds(ids: string[]): Promise<void> {
    const existingPermissions = await this.prismaService.endpointPermission.findMany({
      where: {
        id: { in: ids },
        deletedAt: null
      },
      select: { id: true }
    })

    const existingIds = existingPermissions.map((perm) => perm.id)
    const missingIds = ids.filter((id) => !existingIds.includes(id))

    if (missingIds.length > 0) {
      throw createPermissionNotFoundError(missingIds)
    }
  }

  /**
   * Lấy thông tin chi tiết permissions theo IDs
   * @param ids - Array endpointPermission IDs
   * @returns Array permissions với thông tin đầy đủ
   */
  findByIds(ids: string[]) {
    return this.prismaService.endpointPermission.findMany({
      where: {
        id: { in: ids },
        deletedAt: null
      }
    })
  }

  /**
   * Lấy thông tin một endpointPermission theo ID
   * @param id - Permission ID
   * @returns Permission object hoặc null
   */
  findById(id: string) {
    return this.prismaService.endpointPermission.findFirst({
      where: {
        id,
        deletedAt: null
      }
    })
  }

  async findActiveIdsByNames(names: readonly string[]): Promise<string[]> {
    if (names.length === 0) {
      return []
    }

    const permissions = await this.prismaService.endpointPermission.findMany({
      where: {
        name: { in: [...names] },
        deletedAt: null,
        isActive: true
      },
      select: {
        id: true,
        name: true
      }
    })

    const foundNames = new Set(permissions.map((permission) => permission.name))
    const missingNames = names.filter((name) => !foundNames.has(name))
    if (missingNames.length > 0) {
      throw createPermissionNotFoundError(missingNames)
    }

    return permissions.map((permission) => permission.id)
  }
}

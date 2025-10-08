import { Injectable } from '@nestjs/common'
import { createPermissionNotFoundError } from '~/shared/errors/shared.error'
import { PrismaService } from '~/shared/services/prisma.service'

/**
 * Repository chia sẻ cho các thao tác permission validation
 */
@Injectable()
export class SharedPermissionRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Validate danh sách permission IDs có tồn tại trong database
   * @param ids - Array permission IDs cần validate
   * @throws Error nếu có IDs không tồn tại
   */
  async validatePermissionIds(ids: string[]): Promise<void> {
    const existingPermissions = await this.prismaService.permission.findMany({
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
   * @param ids - Array permission IDs
   * @returns Array permissions với thông tin đầy đủ
   */
  async findByIds(ids: string[]) {
    return this.prismaService.permission.findMany({
      where: {
        id: { in: ids },
        deletedAt: null
      }
    })
  }

  /**
   * Lấy thông tin một permission theo ID
   * @param id - Permission ID
   * @returns Permission object hoặc null
   */
  async findById(id: string) {
    return this.prismaService.permission.findFirst({
      where: {
        id,
        deletedAt: null
      }
    })
  }
}

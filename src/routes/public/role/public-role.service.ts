import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import { GetPublicRolesResType, PublicRoleType } from './public-role.dto'

@Injectable()
export class PublicRoleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active roles - public access, basic info only
   * Dùng cho dropdowns, select boxes khi tạo user
   */
  async getAllActive(): Promise<GetPublicRolesResType> {
    const roles = await this.prisma.role.findMany({
      where: {
        deletedAt: null,
        isActive: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return {
      data: roles as PublicRoleType[],
      totalItems: roles.length
    }
  }

  /**
   * Get role by ID - public access, basic info only
   */
  async getById(id: string): Promise<PublicRoleType | null> {
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        deletedAt: null,
        isActive: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true
      }
    })

    return role as PublicRoleType | null
  }
}

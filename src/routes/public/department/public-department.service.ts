import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/shared/services/prisma.service'
import { GetPublicDepartmentsResType, PublicDepartmentType } from './public-department.dto'

@Injectable()
export class PublicDepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active departments - public access, basic info only
   * No permission check needed, safe data only
   */
  async getAllActive(): Promise<GetPublicDepartmentsResType> {
    const departments = await this.prisma.department.findMany({
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
      data: departments as PublicDepartmentType[],
      totalItems: departments.length
    }
  }

  /**
   * Get department by ID - public access, basic info only
   * No permission check needed, safe data only
   */
  async getById(id: string): Promise<PublicDepartmentType | null> {
    const department = await this.prisma.department.findFirst({
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

    return department as PublicDepartmentType | null
  }
}

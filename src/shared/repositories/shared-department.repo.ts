import { Injectable } from '@nestjs/common'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class SharedDepartmentRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Check if a department exists by ID
   * @param departmentId - Department ID to check
   * @param includeDeleted - Whether to include soft deleted departments
   * @returns Promise<boolean> - True if department exists
   */
  async exists(departmentId: string, { includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<boolean> {
    const whereClause = includeDeleted ? { id: departmentId } : { id: departmentId, deletedAt: null }

    const department = await this.prismaService.department.findUnique({
      where: whereClause,
      select: { id: true }
    })

    return !!department
  }

  /**
   * Find a department by ID
   * @param departmentId - Department ID
   * @param includeDeleted - Whether to include soft deleted departments
   * @returns Promise<Department | null>
   */
  async findDepartmentById(departmentId: string, { includeDeleted = false }: { includeDeleted?: boolean } = {}) {
    const whereClause = includeDeleted ? { id: departmentId } : { id: departmentId, deletedAt: null, isActive: true }

    return this.prismaService.department.findUnique({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        headUserId: true,
        isActive: true
      }
    })
  }
}

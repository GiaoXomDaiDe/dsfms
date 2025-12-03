import { Injectable } from '@nestjs/common'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class SharedDepartmentRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async exists(departmentId: string): Promise<boolean> {
    const department = await this.prismaService.department.findUnique({
      where: { id: departmentId, deletedAt: null, isActive: true },
      select: { id: true }
    })

    return !!department
  }

  async findActiveDepartmentById(departmentId: string) {
    return this.prismaService.department.findUnique({
      where: { id: departmentId, deletedAt: null, isActive: true },
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

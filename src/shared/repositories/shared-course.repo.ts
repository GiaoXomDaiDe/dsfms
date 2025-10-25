import { Injectable } from '@nestjs/common'
import { CourseStatus } from '@prisma/client'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
@SerializeAll()
export class SharedCourseRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Check if a course exists by ID
   * @param courseId - Course ID to check
   * @param includeDeleted - Whether to include soft deleted courses
   * @returns Promise<boolean> - True if course exists
   */
  async exists(courseId: string, { includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<boolean> {
    const whereClause = includeDeleted ? { id: courseId } : { id: courseId, deletedAt: null }

    const course = await this.prismaService.course.findFirst({
      where: whereClause,
      select: { id: true }
    })

    return !!course
  }

  /**
   * Find a course by ID
   * @param courseId - Course ID
   * @param includeDeleted - Whether to include soft deleted courses
   * @returns Promise<Course | null>
   */
  async findById(courseId: string, { includeDeleted = false }: { includeDeleted?: boolean } = {}) {
    const whereClause = includeDeleted
      ? { id: courseId }
      : { id: courseId, deletedAt: null, status: { not: CourseStatus.ARCHIVED } }

    return this.prismaService.course.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true
      }
    })
  }

  async getMaxTraineeCapacity(courseId: string): Promise<number | null> {
    const course = await this.prismaService.course.findFirst({
      where: { id: courseId },
      select: { maxNumTrainee: true }
    })

    return course?.maxNumTrainee ?? null
  }

  /**
   * Find courses by department ID
   * @param departmentId - Department ID
   * @param includeDeleted - Whether to include soft deleted courses
   * @returns Promise<Course[]>
   */
  async findByDepartmentId(departmentId: string, { includeDeleted = false }: { includeDeleted?: boolean } = {}) {
    const whereClause = includeDeleted ? { departmentId } : { departmentId, deletedAt: null }

    return this.prismaService.course.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        departmentId: true
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * Retrieve the departmentId for an active (non archived, non deleted) course
   */
  async findActiveDepartmentId(courseId: string): Promise<string | null> {
    const course = await this.prismaService.course.findFirst({
      where: {
        id: courseId,
        status: { not: CourseStatus.ARCHIVED },
        deletedAt: null
      },
      select: { departmentId: true }
    })

    return course?.departmentId ?? null
  }
}

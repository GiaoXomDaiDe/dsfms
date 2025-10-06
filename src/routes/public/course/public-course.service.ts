import { Injectable } from '@nestjs/common'
import { CourseStatus } from '@prisma/client'
import { PrismaService } from '~/shared/services/prisma.service'
import { GetPublicCoursesResType, PublicCourseType } from './public-course.dto'

@Injectable()
export class PublicCourseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all active courses - public access, basic info only
   * Include department name for convenience
   */
  async getAllActive(): Promise<GetPublicCoursesResType> {
    const courses = await this.prisma.course.findMany({
      where: {
        deletedAt: null,
        status: {
          not: CourseStatus.ARCHIVED
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        departmentId: true,
        status: true,
        department: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    const transformedCourses = courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      departmentId: course.departmentId,
      departmentName: course.department?.name || '',
      isActive: course.status === CourseStatus.ARCHIVED ? 'INACTIVE' : 'ACTIVE'
    })) as PublicCourseType[]

    return {
      data: transformedCourses,
      totalItems: transformedCourses.length
    }
  }

  /**
   * Get courses by department ID - public access
   */
  async getByDepartmentId(departmentId: string): Promise<GetPublicCoursesResType> {
    const courses = await this.prisma.course.findMany({
      where: {
        departmentId,
        deletedAt: null,
        status: {
          not: CourseStatus.ARCHIVED
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        departmentId: true,
        status: true,
        department: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    const transformedCourses = courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      departmentId: course.departmentId,
      departmentName: course.department?.name || '',
      isActive: course.status === CourseStatus.ARCHIVED ? 'INACTIVE' : 'ACTIVE'
    })) as PublicCourseType[]

    return {
      data: transformedCourses,
      totalItems: transformedCourses.length
    }
  }

  /**
   * Get course by ID - public access, basic info only
   */
  async getById(id: string): Promise<PublicCourseType | null> {
    const course = await this.prisma.course.findFirst({
      where: {
        id,
        deletedAt: null,
        status: {
          not: CourseStatus.ARCHIVED
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        departmentId: true,
        status: true,
        department: {
          select: {
            name: true
          }
        }
      }
    })

    if (!course) return null

    return {
      id: course.id,
      name: course.name,
      description: course.description,
      departmentId: course.departmentId,
      departmentName: course.department?.name || '',
      isActive: course.status === CourseStatus.ARCHIVED ? 'INACTIVE' : 'ACTIVE'
    } as PublicCourseType
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { RoleName } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  CourseDetailResType,
  CourseStatsType,
  CourseType,
  CourseWithInfoType,
  CreateCourseBodyType,
  DepartmentWithCoursesType,
  GetCoursesQueryType,
  GetCoursesResType,
  UpdateCourseBodyType
} from './course.model'
import { CourseRepo } from './course.repo'

// Custom exceptions
export const CourseNotFoundException = new NotFoundException('Course not found')
export const CourseCodeAlreadyExistsException = new BadRequestException('Course code already exists')
export const DepartmentNotFoundException = new NotFoundException('Department not found')
export const InvalidDateRangeException = new BadRequestException('End date must be after start date')

@Injectable()
export class CourseService {
  constructor(
    private readonly courseRepo: CourseRepo,
    private readonly prisma: PrismaService
  ) {}

  async list(
    query: GetCoursesQueryType,
    userContext?: { userId: string; userRole: string; departmentId?: string }
  ): Promise<GetCoursesResType> {
    // Apply role-based filtering
    const enhancedQuery = { ...query }

    if (userContext) {
      // Department heads can only see courses in their department (unless explicitly overridden)
      if (userContext.userRole === RoleName.DEPARTMENT_HEAD && !query.departmentId && userContext.departmentId) {
        enhancedQuery.departmentId = userContext.departmentId
      }

      // Trainers can see courses where they are instructors (if no department filter)
      if (userContext.userRole === RoleName.TRAINER && !query.departmentId) {
        const instructedCourses = await this.prisma.subjectInstructor.findMany({
          where: {
            trainerUserId: userContext.userId,
            subject: { deletedAt: null }
          },
          select: {
            subject: {
              select: { courseId: true }
            }
          }
        })

        const courseIds = [...new Set(instructedCourses.map((i) => i.subject.courseId))]
        enhancedQuery.courseIds = courseIds
      }

      // Trainees can see courses where they are enrolled (if no department filter)
      if (userContext.userRole === RoleName.TRAINEE && !query.departmentId) {
        const enrolledCourses = await this.prisma.subjectEnrollment.findMany({
          where: {
            traineeUserId: userContext.userId,
            subject: { deletedAt: null }
          },
          select: {
            subject: {
              select: { courseId: true }
            }
          }
        })

        const courseIds = [...new Set(enrolledCourses.map((e) => e.subject.courseId))]
        enhancedQuery.courseIds = courseIds
      }
    }

    return await this.courseRepo.list(enhancedQuery)
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<CourseDetailResType> {
    const course = await this.courseRepo.findById(id, { includeDeleted })
    if (!course) {
      throw CourseNotFoundException
    }
    return course
  }

  async create({
    data,
    createdById,
    createdByRoleName,
    userDepartmentId
  }: {
    data: CreateCourseBodyType
    createdById: string
    createdByRoleName: string
    userDepartmentId?: string
  }): Promise<CourseType> {
    // Validate permissions - only ADMIN and DEPARTMENT_HEAD can create courses
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(createdByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can create courses')
    }

    // If user is DEPARTMENT_HEAD, validate they can only create courses in their department
    if (createdByRoleName === RoleName.DEPARTMENT_HEAD) {
      if (!userDepartmentId || userDepartmentId !== data.departmentId) {
        throw new ForbiddenException('Department heads can only create courses in their own department')
      }
    }

    // Validate department exists
    const department = await this.prisma.department.findUnique({
      where: { id: data.departmentId, deletedAt: null }
    })

    if (!department) {
      throw DepartmentNotFoundException
    }

    // Validate course code is unique
    const codeExists = await this.courseRepo.checkCodeExists(data.code)
    if (codeExists) {
      throw CourseCodeAlreadyExistsException
    }

    // Validate date range if both dates are provided
    if (data.startDate && data.endDate) {
      if (new Date(data.startDate) >= new Date(data.endDate)) {
        throw InvalidDateRangeException
      }
    }

    return await this.courseRepo.create({ data, createdById })
  }

  async update({
    id,
    data,
    updatedById,
    updatedByRoleName,
    userDepartmentId
  }: {
    id: string
    data: UpdateCourseBodyType
    updatedById: string
    updatedByRoleName: string
    userDepartmentId?: string
  }): Promise<CourseType> {
    // Check if course exists
    const existingCourse = await this.courseRepo.findById(id)
    if (!existingCourse) {
      throw CourseNotFoundException
    }

    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(updatedByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can update courses')
    }

    // If user is DEPARTMENT_HEAD, validate they can only update courses in their department
    if (updatedByRoleName === RoleName.DEPARTMENT_HEAD) {
      const targetDepartmentId = data.departmentId || existingCourse.departmentId

      if (!userDepartmentId || userDepartmentId !== targetDepartmentId) {
        throw new ForbiddenException('Department heads can only update courses in their own department')
      }
    }

    // Validate new department exists if changing department
    if (data.departmentId && data.departmentId !== existingCourse.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: data.departmentId, deletedAt: null }
      })

      if (!department) {
        throw DepartmentNotFoundException
      }
    }

    // Validate course code is unique if changing code
    if (data.code && data.code !== existingCourse.code) {
      const codeExists = await this.courseRepo.checkCodeExists(data.code, id)
      if (codeExists) {
        throw CourseCodeAlreadyExistsException
      }
    }

    // Validate date range if updating dates
    const startDate = data.startDate || existingCourse.startDate
    const endDate = data.endDate || existingCourse.endDate

    if (startDate && endDate) {
      if (new Date(startDate) >= new Date(endDate)) {
        throw InvalidDateRangeException
      }
    }

    return await this.courseRepo.update({ id, data, updatedById })
  }

  async delete({
    id,
    deletedById,
    deletedByRoleName,
    userDepartmentId,
    isHard = false
  }: {
    id: string
    deletedById: string
    deletedByRoleName: string
    userDepartmentId?: string
    isHard?: boolean
  }): Promise<CourseType> {
    // Check if course exists
    const existingCourse = await this.courseRepo.findById(id)
    if (!existingCourse) {
      throw CourseNotFoundException
    }

    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(deletedByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can delete courses')
    }

    // If user is DEPARTMENT_HEAD, validate they can only delete courses in their department
    if (deletedByRoleName === RoleName.DEPARTMENT_HEAD) {
      if (!userDepartmentId || userDepartmentId !== existingCourse.departmentId) {
        throw new ForbiddenException('Department heads can only delete courses in their own department')
      }
    }

    // Check if course has subjects before deletion
    if (isHard) {
      const subjectCount = await this.prisma.subject.count({
        where: { courseId: id, deletedAt: null }
      })

      if (subjectCount > 0) {
        throw new BadRequestException('Cannot permanently delete course with active subjects')
      }
    }

    return await this.courseRepo.delete({ id, deletedById, isHard })
  }

  async archive({
    id,
    archivedById,
    archivedByRoleName,
    userDepartmentId
  }: {
    id: string
    archivedById: string
    archivedByRoleName: string
    userDepartmentId?: string
  }): Promise<CourseType> {
    // Check if course exists
    const existingCourse = await this.courseRepo.findById(id)
    if (!existingCourse) {
      throw CourseNotFoundException
    }

    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(archivedByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can archive courses')
    }

    // If user is DEPARTMENT_HEAD, validate they can only archive courses in their department
    if (archivedByRoleName === RoleName.DEPARTMENT_HEAD) {
      if (!userDepartmentId || userDepartmentId !== existingCourse.departmentId) {
        throw new ForbiddenException('Department heads can only archive courses in their own department')
      }
    }

    // Archive by changing status to ARCHIVED instead of soft delete
    return await this.courseRepo.update({
      id,
      data: { status: 'ARCHIVED' as any },
      updatedById: archivedById
    })
  }

  async restore({
    id,
    restoredById,
    restoredByRoleName
  }: {
    id: string
    restoredById: string
    restoredByRoleName: string
  }): Promise<CourseType> {
    // Check if course exists (including deleted)
    const existingCourse = await this.courseRepo.findById(id, { includeDeleted: true })
    if (!existingCourse) {
      throw CourseNotFoundException
    }

    // Check if course is actually deleted
    if (!existingCourse.deletedAt) {
      throw new BadRequestException('Course is not deleted')
    }

    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(restoredByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can restore courses')
    }

    // If user is DEPARTMENT_HEAD, validate they can only restore courses in their department
    if (restoredByRoleName === RoleName.DEPARTMENT_HEAD) {
      const restorer = await this.prisma.user.findUnique({
        where: { id: restoredById },
        select: { departmentId: true }
      })

      if (!restorer?.departmentId || restorer.departmentId !== existingCourse.departmentId) {
        throw new ForbiddenException('Department heads can only restore courses in their own department')
      }
    }

    // Check if course code conflicts with existing active courses
    const codeExists = await this.courseRepo.checkCodeExists(existingCourse.code, id)
    if (codeExists) {
      throw new BadRequestException('Cannot restore course: code conflicts with existing active course')
    }

    return await this.courseRepo.restore({ id, restoredById })
  }

  async getStats({ includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<CourseStatsType> {
    return await this.courseRepo.getStats({ includeDeleted })
  }

  async getCoursesByDepartment({
    departmentId,
    includeDeleted = false
  }: {
    departmentId: string
    includeDeleted?: boolean
  }): Promise<CourseWithInfoType[]> {
    const result = await this.courseRepo.list({
      page: 1,
      limit: 1000, // Large limit to get all courses
      departmentId,
      includeDeleted
    })

    return result.courses
  }

  async getDepartmentWithCourses({
    departmentId,
    includeDeleted = false,
    query,
    userId,
    userRole
  }: {
    departmentId: string
    includeDeleted?: boolean
    query: GetCoursesQueryType
    userId: string
    userRole: string
  }): Promise<DepartmentWithCoursesType> {
    // Validate access to department
    if (userRole === RoleName.DEPARTMENT_HEAD) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true }
      })

      if (!user?.departmentId || user.departmentId !== departmentId) {
        throw new ForbiddenException('You can only access courses in your own department')
      }
    }

    // Get department details
    const department = await this.prisma.department.findUnique({
      where: {
        id: departmentId,
        ...(includeDeleted ? {} : { deletedAt: null })
      },
      include: {
        headUser: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    if (!department) {
      throw DepartmentNotFoundException
    }

    // Get courses for this department
    const coursesQuery = {
      ...query,
      departmentId,
      includeDeleted
    }

    const courses = await this.courseRepo.list(coursesQuery)

    return {
      department: {
        id: department.id,
        name: department.name,
        code: department.code,
        description: department.description,
        headUser: department.headUser,
        isActive: department.isActive === 'ACTIVE',
        createdAt: department.createdAt.toISOString(),
        updatedAt: department.updatedAt.toISOString()
      },
      courses
    }
  }

  async validateCourseAccess({
    courseId,
    userId,
    userRole
  }: {
    courseId: string
    userId: string
    userRole: string
  }): Promise<boolean> {
    // Admins have access to all courses
    if (userRole === RoleName.ADMINISTRATOR) {
      return true
    }

    // Get course details
    const course = await this.courseRepo.findById(courseId)
    if (!course) {
      return false
    }

    // Department heads have access to courses in their department
    if (userRole === RoleName.DEPARTMENT_HEAD) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true }
      })

      return user?.departmentId === course.departmentId
    }

    // Trainers have access to courses where they are assigned as instructors
    if (userRole === RoleName.TRAINER) {
      const instructorCount = await this.prisma.subjectInstructor.count({
        where: {
          trainerUserId: userId,
          subject: {
            courseId,
            deletedAt: null
          }
        }
      })

      return instructorCount > 0
    }

    // Trainees have access to courses where they are enrolled
    if (userRole === RoleName.TRAINEE) {
      const enrollmentCount = await this.prisma.subjectEnrollment.count({
        where: {
          traineeUserId: userId,
          subject: {
            courseId,
            deletedAt: null
          }
        }
      })

      return enrollmentCount > 0
    }

    return false
  }
}

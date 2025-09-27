import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { RoleName } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  CourseDetailResType,
  CourseStatsType,
  CourseType,
  CourseWithInfoType,
  CreateCourseBodyType,
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

  async list(query: GetCoursesQueryType): Promise<GetCoursesResType> {
    return await this.courseRepo.list(query)
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
    createdByRoleName
  }: {
    data: CreateCourseBodyType
    createdById: string
    createdByRoleName: string
  }): Promise<CourseType> {
    // Validate permissions - only ADMIN and DEPARTMENT_HEAD can create courses
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(createdByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can create courses')
    }

    // If user is DEPARTMENT_HEAD, validate they can only create courses in their department
    if (createdByRoleName === RoleName.DEPARTMENT_HEAD) {
      const creator = await this.prisma.user.findUnique({
        where: { id: createdById },
        select: { departmentId: true }
      })

      if (!creator?.departmentId || creator.departmentId !== data.departmentId) {
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
    updatedByRoleName
  }: {
    id: string
    data: UpdateCourseBodyType
    updatedById: string
    updatedByRoleName: string
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
      const updater = await this.prisma.user.findUnique({
        where: { id: updatedById },
        select: { departmentId: true }
      })

      const targetDepartmentId = data.departmentId || existingCourse.departmentId

      if (!updater?.departmentId || updater.departmentId !== targetDepartmentId) {
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
    isHard = false
  }: {
    id: string
    deletedById: string
    deletedByRoleName: string
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
      const deleter = await this.prisma.user.findUnique({
        where: { id: deletedById },
        select: { departmentId: true }
      })

      if (!deleter?.departmentId || deleter.departmentId !== existingCourse.departmentId) {
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

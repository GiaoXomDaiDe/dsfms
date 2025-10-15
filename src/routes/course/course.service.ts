import { Injectable } from '@nestjs/common'
import { RoleName } from '~/shared/constants/auth.constant'
import { MessageResType } from '~/shared/models/response.model'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  CannotHardDeleteCourseWithActiveSubjectsException,
  CannotRestoreCourseCodeConflictException,
  CourseCodeAlreadyExistsException,
  CourseIsNotDeletedException,
  CourseNotFoundException,
  DepartmentNotFoundException,
  InvalidDateRangeException,
  OnlyAcademicDepartmentCanAddSubjectsToCourseException,
  OnlyAcademicDepartmentCanArchiveCourseException,
  OnlyAcademicDepartmentCanCreateCourseException,
  OnlyAcademicDepartmentCanDeleteCourseException,
  OnlyAcademicDepartmentCanRestoreCourseException,
  OnlyAcademicDepartmentCanUpdateCourseException
} from './course.error'
import {
  AddSubjectToCourseBodyType,
  AddSubjectToCourseResType,
  CourseType,
  CreateCourseBodyType,
  GetCourseResType,
  GetCoursesQueryType,
  GetCoursesResType,
  UpdateCourseBodyType
} from './course.model'
import { CourseRepo } from './course.repo'

@Injectable()
export class CourseService {
  constructor(
    private readonly courseRepo: CourseRepo,
    private readonly prisma: PrismaService
  ) {}

  async list({
    includeDeleted = false,
    activeUserRoleName
  }: GetCoursesQueryType & { activeUserRoleName?: string } = {}): Promise<GetCoursesResType> {
    return await this.courseRepo.list({
      includeDeleted: activeUserRoleName === RoleName.ACADEMIC_DEPARTMENT ? includeDeleted : false
    })
  }

  async findById(id: string, { includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<GetCourseResType> {
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
    // Validate permissions - only ACADEMIC_DEPARTMENT can create courses
    if (createdByRoleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAcademicDepartmentCanCreateCourseException
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

    // Validate permissions - only ACADEMIC_DEPARTMENT can update courses
    if (updatedByRoleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAcademicDepartmentCanUpdateCourseException
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
  }): Promise<MessageResType> {
    // Check if course exists
    const existingCourse = await this.courseRepo.findById(id)
    if (!existingCourse) {
      throw CourseNotFoundException
    }

    // Validate permissions - only ACADEMIC_DEPARTMENT can delete courses
    if (deletedByRoleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAcademicDepartmentCanDeleteCourseException
    }

    // Check if course has subjects before deletion
    if (isHard) {
      const subjectCount = await this.prisma.subject.count({
        where: { courseId: id, deletedAt: null }
      })

      if (subjectCount > 0) {
        throw CannotHardDeleteCourseWithActiveSubjectsException
      }
    }

    await this.courseRepo.delete({ id, deletedById, isHard })

    return { message: isHard ? 'Course permanently deleted successfully' : 'Course deleted successfully' }
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
  }): Promise<MessageResType> {
    // Check if course exists
    const existingCourse = await this.courseRepo.findById(id)
    if (!existingCourse) {
      throw CourseNotFoundException
    }

    // Validate permissions - only ACADEMIC_DEPARTMENT can archive courses
    if (archivedByRoleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAcademicDepartmentCanArchiveCourseException
    }

    // Archive by changing status to ARCHIVED instead of soft delete
    await this.courseRepo.update({
      id,
      data: { status: 'ARCHIVED' as any },
      updatedById: archivedById
    })

    return { message: 'Course archived successfully' }
  }

  async restore({
    id,
    restoredById,
    restoredByRoleName
  }: {
    id: string
    restoredById: string
    restoredByRoleName: string
  }): Promise<MessageResType> {
    // Check if course exists (including deleted)
    const existingCourse = await this.courseRepo.findById(id, { includeDeleted: true })
    if (!existingCourse) {
      throw CourseNotFoundException
    }

    // Check if course is actually deleted
    if (!existingCourse.deletedAt) {
      throw CourseIsNotDeletedException
    }

    // Validate permissions - only ACADEMIC_DEPARTMENT can restore courses
    if (restoredByRoleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAcademicDepartmentCanRestoreCourseException
    }

    // Check if course code conflicts with existing active courses
    const codeExists = await this.courseRepo.checkCodeExists(existingCourse.code, id)
    if (codeExists) {
      throw CannotRestoreCourseCodeConflictException
    }

    await this.courseRepo.restore({ id, restoredById })

    return { message: 'Course restored successfully' }
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
    // Admins have read access to all courses (but not management rights)
    if (userRole === RoleName.ADMINISTRATOR) {
      return true
    }

    // Academic department has full access to all courses
    if (userRole === RoleName.ACADEMIC_DEPARTMENT) {
      return true
    }

    // Get course details
    const course = await this.courseRepo.findById(courseId)
    if (!course) {
      return false
    }

    // Department heads have general read access to all courses
    if (userRole === RoleName.DEPARTMENT_HEAD) {
      return true
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

  /**
   * Thêm subjects vào course
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền
   * - Kiểm tra course tồn tại
   * - Kiểm tra subjects tồn tại và chưa được assign vào course khác
   */
  async addSubjectsToCourse({
    courseId,
    data,
    userRole
  }: {
    courseId: string
    data: AddSubjectToCourseBodyType
    userRole: string
  }): Promise<AddSubjectToCourseResType> {
    // Chỉ ACADEMIC_DEPARTMENT mới có quyền
    if (userRole !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAcademicDepartmentCanAddSubjectsToCourseException
    }

    // Kiểm tra course tồn tại
    const course = await this.findById(courseId)
    if (!course) {
      throw CourseNotFoundException
    }

    const { subjectIds } = data
    const addedSubjects: string[] = []
    const notFoundSubjects: string[] = []
    const alreadyAssignedSubjects: string[] = []

    // Kiểm tra từng subject
    for (const subjectId of subjectIds) {
      // Kiểm tra subject tồn tại
      const subject = await this.prisma.subject.findUnique({
        where: { id: subjectId, deletedAt: null },
        select: { id: true, courseId: true }
      })

      if (!subject) {
        notFoundSubjects.push(subjectId)
        continue
      }

      // Kiểm tra subject đã được assign vào course khác chưa
      if (subject.courseId && subject.courseId !== courseId) {
        alreadyAssignedSubjects.push(subjectId)
        continue
      }

      // Nếu subject chưa có courseId hoặc đã thuộc course này
      if (!subject.courseId) {
        // Assign subject vào course
        await this.prisma.subject.update({
          where: { id: subjectId },
          data: { courseId }
        })
        addedSubjects.push(subjectId)
      }
    }

    const totalRequested = subjectIds.length
    const totalAdded = addedSubjects.length
    const totalNotFound = notFoundSubjects.length
    const totalAlreadyAssigned = alreadyAssignedSubjects.length

    return {
      success: totalAdded > 0,
      addedSubjects,
      notFoundSubjects,
      alreadyAssignedSubjects,
      message: `Successfully added ${totalAdded}/${totalRequested} subjects to course. ${totalNotFound} not found, ${totalAlreadyAssigned} already assigned to other courses.`
    }
  }

  /**
   * Remove subjects khỏi course
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền
   * - Kiểm tra course tồn tại
   * - Set courseId = null cho subjects
   */
  // async removeSubjectsFromCourse({
  //   courseId,
  //   data,
  //   userRole
  // }: {
  //   courseId: string
  //   data: RemoveSubjectFromCourseBodyType
  //   userRole: string
  // }): Promise<RemoveSubjectFromCourseResType> {
  //   // Chỉ ACADEMIC_DEPARTMENT mới có quyền
  //   if (userRole !== RoleName.ACADEMIC_DEPARTMENT) {
  //     throw OnlyAcademicDepartmentCanRemoveSubjectsFromCourseException
  //   }

  //   // Kiểm tra course tồn tại
  //   const course = await this.findById(courseId)
  //   if (!course) {
  //     throw CourseNotFoundException
  //   }

  //   const { subjectIds } = data
  //   const removedSubjects: string[] = []
  //   const notFoundSubjects: string[] = []
  //   const notAssignedSubjects: string[] = []

  //   // Kiểm tra từng subject
  //   for (const subjectId of subjectIds) {
  //     // Kiểm tra subject tồn tại
  //     const subject = await this.prisma.subject.findUnique({
  //       where: { id: subjectId, deletedAt: null },
  //       select: { id: true, courseId: true }
  //     })

  //     if (!subject) {
  //       notFoundSubjects.push(subjectId)
  //       continue
  //     }

  //     // Kiểm tra subject có thuộc course này không
  //     if (subject.courseId !== courseId) {
  //       notAssignedSubjects.push(subjectId)
  //       continue
  //     }

  //     // Remove subject khỏi course
  //     await this.prisma.subject.update({
  //       where: { id: subjectId },
  //       data: { courseId: null }
  //     })
  //     removedSubjects.push(subjectId)
  //   }

  //   const totalRequested = subjectIds.length
  //   const totalRemoved = removedSubjects.length
  //   const totalNotFound = notFoundSubjects.length
  //   const totalNotAssigned = notAssignedSubjects.length

  //   return {
  //     success: totalRemoved > 0,
  //     removedSubjects,
  //     notFoundSubjects,
  //     notAssignedSubjects,
  //     message: `Successfully removed ${totalRemoved}/${totalRequested} subjects from course. ${totalNotFound} not found, ${totalNotAssigned} not assigned to this course.`
  //   }
  // }
}

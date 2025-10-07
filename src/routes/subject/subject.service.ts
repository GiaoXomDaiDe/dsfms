import { Injectable } from '@nestjs/common'
import { RoleName } from '~/shared/constants/auth.constant'
import {
  isForeignKeyConstraintPrismaError,
  isNotFoundPrismaError,
  isUniqueConstraintPrismaError
} from '~/shared/helper'
import { SharedCourseRepository } from '~/shared/repositories/shared-course.repo'
import { SharedDepartmentRepository } from '~/shared/repositories/shared-department.repo'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import {
  BulkInvalidDateRangeAtIndexException,
  BulkSubjectCodeAlreadyExistsAtIndexException,
  BulkSubjectCreationFailedException,
  CannotHardDeleteSubjectWithEnrollmentsException,
  CannotHardDeleteSubjectWithInstructorsException,
  CannotRestoreSubjectCodeConflictException,
  CourseNotFoundException,
  DepartmentHeadCanOnlyManageOwnDepartmentSubjectsException,
  InvalidDateRangeException,
  OnlyAdminAndDepartmentHeadCanCreateSubjectsException,
  OnlyAdminAndDepartmentHeadCanDeleteSubjectsException,
  OnlyAdminAndDepartmentHeadCanRestoreSubjectsException,
  OnlyAdminAndDepartmentHeadCanUpdateSubjectsException,
  SubjectCodeAlreadyExistsException,
  SubjectIsNotDeletedException,
  SubjectNotFoundException
} from './subject.error'
import {
  BulkCreateSubjectsBodyType,
  BulkCreateSubjectsResType,
  CreateSubjectBodyType,
  GetSubjectsQueryType,
  GetSubjectsResType,
  SubjectDetailResType,
  SubjectEntityType,
  SubjectWithInfoType,
  UpdateSubjectBodyType
} from './subject.model'
import { SubjectRepo } from './subject.repo'

@Injectable()
export class SubjectService {
  constructor(
    private readonly subjectRepo: SubjectRepo,
    private readonly sharedDepartmentRepository: SharedDepartmentRepository,
    private readonly sharedCourseRepository: SharedCourseRepository,
    private readonly sharedUserRepository: SharedUserRepository
  ) {}

  /**
   * Lấy danh sách subjects với phân trang và filter.
   * Chỉ ADMINISTRATOR mới được phép xem subject đã bị xóa mềm.
   * @param query - Query parameters bao gồm page, limit, search, filters
   */
  async list(query: GetSubjectsQueryType): Promise<GetSubjectsResType> {
    return await this.subjectRepo.list(query)
  }

  /**
   * Lấy thông tin chi tiết một subject kèm theo instructors và enrollments.
   * Chỉ ADMINISTRATOR mới được phép xem subject đã bị xóa mềm.
   * @param id - ID của subject
   * @param options - Tùy chọn includeDeleted
   */
  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<SubjectDetailResType> {
    const subject = await this.subjectRepo.findById(id, { includeDeleted })

    if (!subject) {
      throw SubjectNotFoundException
    }

    return subject
  }

  /**
   * Tạo mới một subject cho course.
   * - Chỉ ADMINISTRATOR và DEPARTMENT_HEAD mới có quyền tạo
   * - DEPARTMENT_HEAD chỉ có thể tạo subject cho course thuộc department của họ
   * - Kiểm tra course tồn tại và không bị xóa
   * - Kiểm tra subject code duy nhất
   * - Validate date range
   */
  async create({
    data,
    createdById,
    createdByRoleName
  }: {
    data: CreateSubjectBodyType
    createdById: string
    createdByRoleName: string
  }): Promise<SubjectEntityType> {
    try {
      // Kiểm tra quyền tạo subject
      this.validateCreatePermissions(createdByRoleName)

      // Kiểm tra course tồn tại
      const course = await this.sharedCourseRepository.findById(data.courseId)
      if (!course) {
        throw CourseNotFoundException
      }

      // Kiểm tra DEPARTMENT_HEAD chỉ tạo subject cho course trong department của họ
      if (createdByRoleName === RoleName.DEPARTMENT_HEAD) {
        await this.validateDepartmentHeadAccess(createdById, course.departmentId)
      }

      // Kiểm tra subject code unique
      const codeExists = await this.subjectRepo.checkCodeExists(data.code)
      if (codeExists) {
        throw SubjectCodeAlreadyExistsException
      }

      // Validate date range
      this.validateDateRange(data.startDate, data.endDate)

      return await this.subjectRepo.create({ data, createdById })
    } catch (error) {
      if (isForeignKeyConstraintPrismaError(error)) {
        throw CourseNotFoundException
      }
      if (isUniqueConstraintPrismaError(error)) {
        throw SubjectCodeAlreadyExistsException
      }
      throw error
    }
  }

  /**
   * Tạo nhiều subjects cùng lúc cho một course.
   * - Chỉ ADMINISTRATOR và DEPARTMENT_HEAD mới có quyền tạo
   * - DEPARTMENT_HEAD chỉ có thể tạo subject cho course thuộc department của họ
   * - Validate từng subject riêng biệt và trả về kết quả chi tiết
   */
  async bulkCreate({
    data,
    createdById,
    createdByRoleName
  }: {
    data: BulkCreateSubjectsBodyType
    createdById: string
    createdByRoleName: string
  }): Promise<BulkCreateSubjectsResType> {
    const { courseId, subjects } = data

    // Kiểm tra quyền tạo subject
    this.validateCreatePermissions(createdByRoleName)

    // Kiểm tra course tồn tại
    const course = await this.sharedCourseRepository.findById(courseId)
    if (!course) {
      throw CourseNotFoundException
    }

    // Kiểm tra DEPARTMENT_HEAD chỉ tạo subject cho course trong department của họ
    if (createdByRoleName === RoleName.DEPARTMENT_HEAD) {
      await this.validateDepartmentHeadAccess(createdById, course.departmentId)
    }

    const createdSubjects: SubjectEntityType[] = []
    const failedSubjects: { subject: any; error: string }[] = []

    // Xử lý từng subject
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i]

      try {
        // Kiểm tra subject code unique
        const codeExists = await this.subjectRepo.checkCodeExists(subject.code)
        if (codeExists) {
          throw new Error(BulkSubjectCodeAlreadyExistsAtIndexException(i, subject.code))
        }

        // Validate date range
        if (subject.startDate && subject.endDate) {
          const isValidRange = new Date(subject.startDate) < new Date(subject.endDate)
          if (!isValidRange) {
            throw new Error(BulkInvalidDateRangeAtIndexException(i))
          }
        }

        // Tạo subject data với courseId
        const createData: CreateSubjectBodyType = {
          ...subject,
          courseId
        }

        const createdSubject = await this.subjectRepo.create({
          data: createData,
          createdById
        })

        createdSubjects.push(createdSubject)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : BulkSubjectCreationFailedException(i, 'Unknown error')

        failedSubjects.push({
          subject,
          error: errorMessage
        })
      }
    }

    return {
      createdSubjects,
      failedSubjects,
      summary: {
        totalRequested: subjects.length,
        totalCreated: createdSubjects.length,
        totalFailed: failedSubjects.length
      }
    }
  }

  /**
   * Cập nhật thông tin subject.
   * - Chỉ ADMINISTRATOR và DEPARTMENT_HEAD mới có quyền update
   * - DEPARTMENT_HEAD chỉ có thể update subject của course trong department của họ
   * - Kiểm tra subject code unique (nếu thay đổi)
   * - Validate date range
   */
  async update({
    id,
    data,
    updatedById,
    updatedByRoleName
  }: {
    id: string
    data: UpdateSubjectBodyType
    updatedById: string
    updatedByRoleName: string
  }): Promise<SubjectEntityType> {
    try {
      // Kiểm tra quyền update
      this.validateUpdatePermissions(updatedByRoleName)

      // Lấy subject hiện tại
      const existingSubject = await this.subjectRepo.findById(id)
      if (!existingSubject) {
        throw SubjectNotFoundException
      }

      // Kiểm tra DEPARTMENT_HEAD chỉ update subject trong department của họ
      if (updatedByRoleName === RoleName.DEPARTMENT_HEAD) {
        const targetCourseId = data.courseId || existingSubject.courseId
        const targetCourse = await this.sharedCourseRepository.findById(targetCourseId)

        if (targetCourse) {
          await this.validateDepartmentHeadAccess(updatedById, targetCourse.departmentId)
        }
      }

      // Validate course mới nếu thay đổi
      if (data.courseId && data.courseId !== existingSubject.courseId) {
        const course = await this.sharedCourseRepository.findById(data.courseId)
        if (!course) {
          throw CourseNotFoundException
        }
      }

      // Validate subject code unique nếu thay đổi
      if (data.code && data.code !== existingSubject.code) {
        const codeExists = await this.subjectRepo.checkCodeExists(data.code, id)
        if (codeExists) {
          throw SubjectCodeAlreadyExistsException
        }
      }

      // Validate date range
      const startDate = data.startDate || existingSubject.startDate
      const endDate = data.endDate || existingSubject.endDate
      this.validateDateRange(startDate, endDate)

      return await this.subjectRepo.update({ id, data, updatedById })
    } catch (error) {
      if (isNotFoundPrismaError(error)) {
        throw SubjectNotFoundException
      }
      if (isUniqueConstraintPrismaError(error)) {
        throw SubjectCodeAlreadyExistsException
      }
      if (isForeignKeyConstraintPrismaError(error)) {
        throw CourseNotFoundException
      }
      throw error
    }
  }

  /**
   * Xóa subject (soft delete hoặc hard delete).
   * - Chỉ ADMINISTRATOR và DEPARTMENT_HEAD mới có quyền xóa
   * - DEPARTMENT_HEAD chỉ có thể xóa subject của course trong department của họ
   * - Hard delete chỉ được phép nếu không có instructors và enrollments
   */
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
  }): Promise<SubjectEntityType> {
    // Kiểm tra quyền xóa
    this.validateDeletePermissions(deletedByRoleName)

    // Lấy subject hiện tại
    const existingSubject = await this.subjectRepo.findById(id)
    if (!existingSubject) {
      throw SubjectNotFoundException
    }

    // Kiểm tra DEPARTMENT_HEAD chỉ xóa subject trong department của họ
    if (deletedByRoleName === RoleName.DEPARTMENT_HEAD) {
      if (existingSubject.course?.departmentId) {
        await this.validateDepartmentHeadAccess(deletedById, existingSubject.course.departmentId)
      }
    }

    // Kiểm tra hard delete
    if (isHard) {
      await this.validateHardDeleteSafety(id)
    }

    return await this.subjectRepo.delete({ id, deletedById, isHard })
  }

  /**
   * Khôi phục subject đã bị xóa mềm.
   * - Chỉ ADMINISTRATOR và DEPARTMENT_HEAD mới có quyền restore
   * - DEPARTMENT_HEAD chỉ có thể restore subject của course trong department của họ
   * - Kiểm tra subject code không conflict
   */
  async restore({
    id,
    restoredById,
    restoredByRoleName
  }: {
    id: string
    restoredById: string
    restoredByRoleName: string
  }): Promise<SubjectEntityType> {
    // Kiểm tra quyền restore
    this.validateRestorePermissions(restoredByRoleName)

    // Lấy subject (bao gồm deleted)
    const existingSubject = await this.subjectRepo.findById(id, { includeDeleted: true })
    if (!existingSubject) {
      throw SubjectNotFoundException
    }

    // Kiểm tra subject có thực sự bị xóa không
    if (!existingSubject.deletedAt) {
      throw SubjectIsNotDeletedException
    }

    // Kiểm tra DEPARTMENT_HEAD chỉ restore subject trong department của họ
    if (restoredByRoleName === RoleName.DEPARTMENT_HEAD) {
      if (existingSubject.course?.departmentId) {
        await this.validateDepartmentHeadAccess(restoredById, existingSubject.course.departmentId)
      }
    }

    // Kiểm tra subject code conflict
    const codeExists = await this.subjectRepo.checkCodeExists(existingSubject.code, id)
    if (codeExists) {
      throw CannotRestoreSubjectCodeConflictException
    }

    return await this.subjectRepo.restore({ id, restoredById })
  }

  /**
   * Lấy danh sách subjects theo course.
   * @param courseId - ID của course
   * @param includeDeleted - Có lấy subjects đã bị xóa không (chỉ ADMIN)
   */
  async getSubjectsByCourse({
    courseId,
    includeDeleted = false
  }: {
    courseId: string
    includeDeleted?: boolean
  }): Promise<SubjectWithInfoType[]> {
    const result = await this.subjectRepo.list({
      page: 1,
      limit: 1000,
      courseId,
      includeDeleted
    })

    return result.subjects
  }

  // =============== PRIVATE HELPER METHODS ===============

  /**
   * Kiểm tra quyền tạo subject
   */
  private validateCreatePermissions(roleName: string): void {
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(roleName as any)) {
      throw OnlyAdminAndDepartmentHeadCanCreateSubjectsException
    }
  }

  /**
   * Kiểm tra quyền update subject
   */
  private validateUpdatePermissions(roleName: string): void {
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(roleName as any)) {
      throw OnlyAdminAndDepartmentHeadCanUpdateSubjectsException
    }
  }

  /**
   * Kiểm tra quyền xóa subject
   */
  private validateDeletePermissions(roleName: string): void {
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(roleName as any)) {
      throw OnlyAdminAndDepartmentHeadCanDeleteSubjectsException
    }
  }

  /**
   * Kiểm tra quyền restore subject
   */
  private validateRestorePermissions(roleName: string): void {
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(roleName as any)) {
      throw OnlyAdminAndDepartmentHeadCanRestoreSubjectsException
    }
  }

  /**
   * Kiểm tra DEPARTMENT_HEAD chỉ có thể thao tác với course trong department của họ
   */
  private async validateDepartmentHeadAccess(userId: string, courseDepartmentId: string): Promise<void> {
    const user = await this.sharedUserRepository.findUnique({ id: userId })

    if (!user?.departmentId || user.departmentId !== courseDepartmentId) {
      throw DepartmentHeadCanOnlyManageOwnDepartmentSubjectsException
    }
  }

  /**
   * Validate date range (end date phải sau start date)
   */
  private validateDateRange(startDate?: string | null, endDate?: string | null): void {
    if (startDate && endDate) {
      if (new Date(startDate) >= new Date(endDate)) {
        throw InvalidDateRangeException
      }
    }
  }

  /**
   * Kiểm tra an toàn khi hard delete (không có instructors và enrollments)
   */
  private async validateHardDeleteSafety(subjectId: string): Promise<void> {
    // Kiểm tra enrollments
    const enrollmentCount = await this.subjectRepo.countEnrollments(subjectId)
    if (enrollmentCount > 0) {
      throw CannotHardDeleteSubjectWithEnrollmentsException
    }

    // Kiểm tra instructors
    const instructorCount = await this.subjectRepo.countInstructors(subjectId)
    if (instructorCount > 0) {
      throw CannotHardDeleteSubjectWithInstructorsException
    }
  }
}

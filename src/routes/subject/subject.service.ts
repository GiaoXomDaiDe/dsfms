import { Injectable } from '@nestjs/common'
import { RoleName } from '~/shared/constants/auth.constant'
import {
  isForeignKeyConstraintPrismaError,
  isNotFoundPrismaError,
  isUniqueConstraintPrismaError
} from '~/shared/helper'
import { SharedCourseRepository } from '~/shared/repositories/shared-course.repo'
import { SharedDepartmentRepository } from '~/shared/repositories/shared-department.repo'
import { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import {
  BulkInvalidDateRangeAtIndexException,
  BulkSubjectCodeAlreadyExistsAtIndexException,
  BulkSubjectCreationFailedException,
  CannotCancelSubjectEnrollmentException,
  CannotEnrollInRecurrentSubjectException,
  CannotHardDeleteSubjectWithEnrollmentsException,
  CannotHardDeleteSubjectWithInstructorsException,
  CannotRestoreSubjectCodeConflictException,
  CourseAtCapacityException,
  CourseNotFoundException,
  DuplicateInstructorException,
  DuplicateTraineeEnrollmentException,
  InvalidDateRangeException,
  InvalidTraineeSubmissionException,
  OnlyAdminAndDepartmentHeadCanCreateSubjectsException,
  OnlyAdminAndDepartmentHeadCanDeleteSubjectsException,
  OnlyAdminAndDepartmentHeadCanRestoreSubjectsException,
  OnlyAdminAndDepartmentHeadCanUpdateSubjectsException,
  SubjectCodeAlreadyExistsException,
  SubjectIsNotDeletedException,
  SubjectNotFoundException,
  TrainerAssignmentNotFoundException
} from './subject.error'
import {
  BulkCreateSubjectsBodyType,
  BulkCreateSubjectsResType,
  CreateSubjectBodyType,
  GetSubjectsQueryType,
  GetSubjectsResType,
  SubjectDetailResType,
  SubjectEntityType,
  SubjectResType,
  UpdateSubjectBodyType
} from './subject.model'
import { SubjectRepo } from './subject.repo'

@Injectable()
export class SubjectService {
  constructor(
    private readonly subjectRepo: SubjectRepo,
    private readonly sharedDepartmentRepository: SharedDepartmentRepository,
    private readonly sharedCourseRepository: SharedCourseRepository,
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly sharedRoleRepository: SharedRoleRepository
  ) {}

  /**
   * Lấy danh sách subjects với phân trang và filter.
   * Chỉ ACADEMIC_DEPARTMENT mới được phép xem subject đã bị xóa mềm.
   * @param query - Query parameters bao gồm page, limit, search, filters
   */
  async list(query: GetSubjectsQueryType): Promise<GetSubjectsResType> {
    return await this.subjectRepo.list(query)
  }

  /**
   * Lấy thông tin chi tiết một subject kèm theo instructors và enrollments.
   * Chỉ ACADEMIC_DEPARTMENT mới được phép xem subject đã bị xóa mềm.
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
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền tạo
   * - ACADEMIC_DEPARTMENT có thể tạo subject cho bất kỳ course nào
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
  }): Promise<SubjectResType> {
    try {
      // Kiểm tra quyền tạo subject
      this.validateCreatePermissions(createdByRoleName)

      // Kiểm tra course tồn tại (nếu có courseId)
      if (data.courseId) {
        const course = await this.sharedCourseRepository.findById(data.courseId)
        if (!course) {
          throw CourseNotFoundException
        }
      }

      // ACADEMIC_DEPARTMENT có thể tạo subject cho bất kỳ course nào
      // Không cần kiểm tra department access

      // Kiểm tra subject code unique
      const codeExists = await this.subjectRepo.checkCodeExists(data.code)
      if (codeExists) {
        throw SubjectCodeAlreadyExistsException
      }

      // Validate date range
      this.validateDateRange(data.startDate, data.endDate)

      return await this.subjectRepo.createSimple({ data, createdById })
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
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền tạo
   * - ACADEMIC_DEPARTMENT có thể tạo subject cho bất kỳ course nào
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

    // ACADEMIC_DEPARTMENT có thể tạo subject cho bất kỳ course nào
    // Không cần kiểm tra department access

    const createdSubjects: SubjectEntityType[] = []
    const failedSubjects: { subject: any; error: string }[] = []

    // Xử lý từng subject
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i]

      try {
        // Kiểm tra subject code unique
        const codeExists = await this.subjectRepo.checkCodeExists(subject.code)
        if (codeExists) {
          throw BulkSubjectCodeAlreadyExistsAtIndexException(i, subject.code)
        }

        // Validate date range
        if (subject.startDate && subject.endDate) {
          const isValidRange = new Date(subject.startDate) < new Date(subject.endDate)
          if (!isValidRange) {
            throw BulkInvalidDateRangeAtIndexException(i)
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
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền update
   * - ACADEMIC_DEPARTMENT có thể update bất kỳ subject nào
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
  }): Promise<SubjectResType> {
    try {
      // Kiểm tra quyền update
      this.validateUpdatePermissions(updatedByRoleName)

      // Lấy subject hiện tại
      const existingSubject = await this.subjectRepo.findById(id)
      if (!existingSubject) {
        throw SubjectNotFoundException
      }

      // ACADEMIC_DEPARTMENT có thể update bất kỳ subject nào
      // Không cần kiểm tra department access

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

      return await this.subjectRepo.updateSimple({ id, data, updatedById })
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
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền xóa
   * - ACADEMIC_DEPARTMENT có thể xóa bất kỳ subject nào
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

    // ACADEMIC_DEPARTMENT có thể xóa bất kỳ subject nào
    // Không cần kiểm tra department access

    // Kiểm tra hard delete
    if (isHard) {
      await this.validateHardDeleteSafety(id)
    }

    return await this.subjectRepo.delete({ id, deletedById, isHard })
  }

  /**
   * Archive subject bằng cách đổi status sang ARCHIVED.
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền archive
   * - ACADEMIC_DEPARTMENT có thể archive bất kỳ subject nào
   */
  async archive({
    id,
    archivedById,
    archivedByRoleName
  }: {
    id: string
    archivedById: string
    archivedByRoleName: string
  }): Promise<SubjectResType> {
    // Kiểm tra quyền archive
    this.validateDeletePermissions(archivedByRoleName) // Sử dụng delete permission vì tương tự

    // Lấy subject hiện tại
    const existingSubject = await this.subjectRepo.findById(id)
    if (!existingSubject) {
      throw SubjectNotFoundException
    }

    // ACADEMIC_DEPARTMENT có thể archive bất kỳ subject nào
    // Không cần kiểm tra department access

    // Archive by changing status to ARCHIVED
    return await this.subjectRepo.updateSimple({
      id,
      data: {},
      updatedById: archivedById
    })
  }

  /**
   * Khôi phục subject đã bị xóa mềm.
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền restore
   * - ACADEMIC_DEPARTMENT có thể restore bất kỳ subject nào
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

    // ACADEMIC_DEPARTMENT có thể restore bất kỳ subject nào
    // Không cần kiểm tra department access

    // Kiểm tra subject code conflict
    const codeExists = await this.subjectRepo.checkCodeExists(existingSubject.code, id)
    if (codeExists) {
      throw CannotRestoreSubjectCodeConflictException
    }

    return await this.subjectRepo.restore({ id, restoredById })
  }

  /**
   * Enroll trainees vào subject.
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền
   * - Validate tất cả trainees tồn tại và có role TRAINEE
   */
  async enrollTrainees({
    subjectId,
    data,
    roleName
  }: {
    subjectId: string
    data: any
    roleName: string
  }): Promise<any> {
    // Kiểm tra quyền
    this.validateUpdatePermissions(roleName)

    // Kiểm tra subject tồn tại
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    // Enroll trainees
    const result = await this.subjectRepo.enrollTrainees({
      subjectId,
      trainees: data.trainees
    })

    return {
      success: true,
      enrolledTrainees: result.enrolledTrainees,
      duplicateTrainees: result.duplicateTrainees,
      message: `Successfully enrolled ${result.enrolledTrainees.length} trainees. ${result.duplicateTrainees.length} duplicates skipped.`
    }
  }

  /**
   * Xóa enrollments từ subject.
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền
   */
  async removeEnrollments({
    subjectId,
    data,
    roleName
  }: {
    subjectId: string
    data: any
    roleName: string
  }): Promise<any> {
    // Kiểm tra quyền
    this.validateUpdatePermissions(roleName)

    // Kiểm tra subject tồn tại
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    // Xóa enrollments
    const result = await this.subjectRepo.removeEnrollments({
      subjectId,
      traineeEids: data.traineeEids
    })

    return {
      success: true,
      removedTrainees: result.removedTrainees,
      notFoundTrainees: result.notFoundTrainees,
      message: `Successfully removed ${result.removedTrainees.length} trainees. ${result.notFoundTrainees.length} not found.`
    }
  }

  // =============== PRIVATE HELPER METHODS ===============

  /**
   * Kiểm tra quyền tạo subject - chỉ ACADEMIC_DEPARTMENT được phép
   */
  private validateCreatePermissions(roleName: string): void {
    if (roleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAdminAndDepartmentHeadCanCreateSubjectsException
    }
  }

  /**
   * Kiểm tra quyền update subject - chỉ ACADEMIC_DEPARTMENT được phép
   */
  private validateUpdatePermissions(roleName: string): void {
    if (roleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAdminAndDepartmentHeadCanUpdateSubjectsException
    }
  }

  /**
   * Kiểm tra quyền xóa subject - chỉ ACADEMIC_DEPARTMENT được phép
   */
  private validateDeletePermissions(roleName: string): void {
    if (roleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAdminAndDepartmentHeadCanDeleteSubjectsException
    }
  }

  /**
   * Kiểm tra quyền restore subject - chỉ ACADEMIC_DEPARTMENT được phép
   */
  private validateRestorePermissions(roleName: string): void {
    if (roleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAdminAndDepartmentHeadCanRestoreSubjectsException
    }
  }

  /**
   * Validate date range (end date phải sau start date)
   */
  private validateDateRange(startDate?: Date | null, endDate?: Date | null): void {
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

  // ========================================
  // TRAINER ASSIGNMENT SERVICE METHODS
  // ========================================

  /**
   * Get available trainers in a department for a course
   */
  async getAvailableTrainers({
    departmentId,
    courseId,
    roleName
  }: {
    departmentId: string
    courseId: string
    roleName: string
  }): Promise<any> {
    this.validateUpdatePermissions(roleName)

    const trainers = await this.subjectRepo.getAvailableTrainersInDepartment({
      departmentId,
      courseId
    })

    return {
      trainers,
      totalCount: trainers.length
    }
  }

  /**
   * Assign trainer to subject
   */
  async assignTrainer({ subjectId, data, roleName }: { subjectId: string; data: any; roleName: string }): Promise<any> {
    this.validateUpdatePermissions(roleName)

    // Validate subject exists
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    // Check if trainer already assigned
    const alreadyAssigned = await this.subjectRepo.isTrainerAssignedToSubject({
      subjectId,
      trainerUserId: data.trainerUserId
    })

    if (alreadyAssigned) {
      throw DuplicateInstructorException
    }

    // Assign trainer
    const assignment = await this.subjectRepo.assignTrainerToSubject({
      subjectId,
      trainerUserId: data.trainerUserId,
      roleInSubject: data.roleInSubject
    })

    return {
      message: 'Trainer assigned successfully',
      data: assignment
    }
  }

  /**
   * Update trainer assignment - Only allows role update
   * To change trainer or subject, use remove + assign operations
   */
  async updateTrainerAssignment({
    currentSubjectId,
    currentTrainerId,
    data,
    roleName
  }: {
    currentSubjectId: string
    currentTrainerId: string
    data: { roleInSubject: any }
    roleName: string
  }): Promise<any> {
    this.validateUpdatePermissions(roleName)

    // Validate current assignment exists
    const exists = await this.subjectRepo.isTrainerAssignedToSubject({
      subjectId: currentSubjectId,
      trainerUserId: currentTrainerId
    })

    if (!exists) {
      throw TrainerAssignmentNotFoundException
    }

    // Update only the role - no trainer or subject change allowed
    const updated = await this.subjectRepo.updateTrainerAssignment({
      currentSubjectId,
      currentTrainerUserId: currentTrainerId,
      newSubjectId: currentSubjectId, // Keep same subject
      newTrainerUserId: currentTrainerId, // Keep same trainer
      newRoleInSubject: data.roleInSubject // Only change role
    })

    return {
      message: 'Trainer role updated successfully',
      data: updated
    }
  }

  /**
   * Remove trainer from subject
   */
  async removeTrainer({
    subjectId,
    trainerId,
    roleName
  }: {
    subjectId: string
    trainerId: string
    roleName: string
  }): Promise<any> {
    this.validateUpdatePermissions(roleName)

    // Validate assignment exists
    const exists = await this.subjectRepo.isTrainerAssignedToSubject({
      subjectId,
      trainerUserId: trainerId
    })

    if (!exists) {
      throw TrainerAssignmentNotFoundException
    }

    await this.subjectRepo.removeTrainerFromSubject({
      subjectId,
      trainerUserId: trainerId
    })

    return {
      message: 'Trainer removed successfully'
    }
  }

  // ========================================
  // TRAINEE ASSIGNMENT SERVICE METHODS
  // ========================================

  /**
   * Lookup trainees by EID or email
   */
  async lookupTrainees({ data }: { data: any }): Promise<any> {
    const result = await this.subjectRepo.lookupTrainees({
      trainees: data.trainees
    })

    return {
      foundUsers: result.foundUsers,
      notFoundIdentifiers: result.notFoundIdentifiers
    }
  }

  /**
   * Assign trainees to subject with comprehensive validation
   */
  async assignTraineesToSubject({
    subjectId,
    data,
    roleName
  }: {
    subjectId: string
    data: any
    roleName: string
  }): Promise<any> {
    this.validateUpdatePermissions(roleName)

    // Validate subject exists
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    // Validation 1: Check course max trainee limit
    if (subject.course?.id) {
      const { current, max } = await this.subjectRepo.getCourseTraineeCount(subject.course.id)

      if (max !== null && current + data.traineeUserIds.length > max) {
        throw CourseAtCapacityException(current, max, data.traineeUserIds.length)
      }
    }

    // Validation 2: Check recurrent subject constraints
    if (subject.type === 'RECURRENT') {
      for (const traineeId of data.traineeUserIds) {
        const { canEnroll, reason } = await this.subjectRepo.canEnrollInRecurrentSubject({
          traineeUserId: traineeId,
          subjectId
        })

        if (!canEnroll) {
          throw CannotEnrollInRecurrentSubjectException(reason)
        }
      }
    }

    // Assign trainees
    const result = await this.subjectRepo.assignTraineesToSubject({
      subjectId,
      traineeUserIds: data.traineeUserIds,
      batchCode: data.batchCode
    })

    if (result.duplicates.length > 0) {
      const duplicateDetails = result.duplicates.map((item) => ({
        eid: item.eid,
        email: item.email,
        batchCode: item.batchCode,
        enrolledAt: item.enrolledAt
      }))

      throw DuplicateTraineeEnrollmentException(duplicateDetails)
    }

    if (result.invalid.length > 0) {
      throw InvalidTraineeSubmissionException(result.invalid)
    }

    return {
      enrolledCount: result.enrolled.length,
      enrolled: result.enrolled
    }
  }

  /**
   * Get all trainees in a course
   */
  async getCourseTrainees({
    courseId,
    query,
    roleName
  }: {
    courseId: string
    query: any
    roleName: string
  }): Promise<any> {
    this.validateUpdatePermissions(roleName)

    const { batchCode } = query

    const result = await this.subjectRepo.getCourseTrainees({
      courseId,
      batchCode
    })

    return {
      trainees: result.trainees,
      totalItems: result.totalItems
    }
  }

  /**
   * Cancel all course enrollments for a trainee in a batch
   */
  async cancelCourseEnrollments({
    courseId,
    traineeId,
    data,
    roleName
  }: {
    courseId: string
    traineeId: string
    data: any
    roleName: string
  }): Promise<any> {
    this.validateUpdatePermissions(roleName)

    const result = await this.subjectRepo.cancelCourseEnrollments({
      courseId,
      traineeUserId: traineeId,
      batchCode: data.batchCode
    })

    return {
      message: `Cancelled ${result.cancelledCount} enrollments. ${result.notCancelledCount} could not be cancelled (already in progress or finished).`,
      data: {
        cancelledCount: result.cancelledCount,
        notCancelledCount: result.notCancelledCount
      }
    }
  }

  /**
   * Get trainee enrollments
   */
  async getTraineeEnrollments({ traineeId, query }: { traineeId: string; query: any }): Promise<any> {
    const result = await this.subjectRepo.getTraineeEnrollments({
      traineeUserId: traineeId,
      batchCode: query.batchCode,
      status: query.status
    })

    return {
      trainee: result.trainee,
      enrollments: result.enrollments,
      totalCount: result.enrollments.length
    }
  }

  /**
   * Cancel specific subject enrollment
   */
  async cancelSubjectEnrollment({
    subjectId,
    traineeId,
    data,
    roleName
  }: {
    subjectId: string
    traineeId: string
    data: any
    roleName: string
  }): Promise<any> {
    this.validateUpdatePermissions(roleName)

    const success = await this.subjectRepo.cancelSubjectEnrollment({
      subjectId,
      traineeUserId: traineeId,
      batchCode: data.batchCode
    })

    if (!success) {
      throw CannotCancelSubjectEnrollmentException
    }

    return {
      message: 'Enrollment cancelled successfully'
    }
  }
}

import { Injectable } from '@nestjs/common'
import { round } from 'lodash'
import { RoleName } from '~/shared/constants/auth.constant'
import { SubjectInstructorRoleValue } from '~/shared/constants/subject.constant'
import { Serialize } from '~/shared/decorators/serialize.decorator'
import {
  isForeignKeyConstraintPrismaError,
  isNotFoundPrismaError,
  isUniqueConstraintPrismaError
} from '~/shared/helper'
import { CourseIdParamsType } from '~/shared/models/shared-course.model'
import { SubjectIdParamsType, SubjectType } from '~/shared/models/shared-subject.model'
import { SharedCourseRepository } from '~/shared/repositories/shared-course.repo'
import { SharedDepartmentRepository } from '~/shared/repositories/shared-department.repo'
import { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import { SharedSubjectRepository } from '~/shared/repositories/shared-subject.repo'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import {
  BulkSubjectCodeAlreadyExistsAtIndexException,
  BulkSubjectCreationFailedException,
  CannotCancelSubjectEnrollmentException,
  CourseAtCapacityException,
  CourseNotFoundException,
  DuplicateInstructorException,
  DuplicateTraineeEnrollmentException,
  InvalidTraineeSubmissionException,
  SubjectCodeAlreadyExistsException,
  SubjectDateOutsideCourseDateRangeException,
  SubjectNotFoundException,
  TrainerAssignmentNotFoundException
} from './subject.error'
import {
  AssignTraineesBodyType,
  AssignTraineesResType,
  AssignTrainerBodyType,
  AssignTrainerResType,
  BulkCreateSubjectsBodyType,
  BulkCreateSubjectsResType,
  CreateSubjectBodyType,
  GetAvailableTrainersResType,
  GetSubjectDetailResType,
  GetSubjectsQueryType,
  GetSubjectsResType,
  LookupTraineesBodyType,
  LookupTraineesResType,
  UpdateSubjectBodyType,
  UpdateTrainerAssignmentResType
} from './subject.model'
import { SubjectRepo } from './subject.repo'

@Injectable()
export class SubjectService {
  constructor(
    private readonly subjectRepo: SubjectRepo,
    private readonly sharedSubjectRepository: SharedSubjectRepository,
    private readonly sharedDepartmentRepository: SharedDepartmentRepository,
    private readonly sharedCourseRepository: SharedCourseRepository,
    private readonly sharedUserRepository: SharedUserRepository,
    private readonly sharedRoleRepository: SharedRoleRepository
  ) {}

  async list(query: GetSubjectsQueryType, userRoleName: string): Promise<GetSubjectsResType> {
    const includeDeleted = userRoleName === RoleName.ACADEMIC_DEPARTMENT

    return await this.subjectRepo.list({
      ...query,
      includeDeleted
    })
  }

  async findById(subjectId: SubjectIdParamsType, { roleName }: { roleName: string }): Promise<GetSubjectDetailResType> {
    const includeDeleted = roleName === RoleName.ACADEMIC_DEPARTMENT

    const subject = await this.subjectRepo.findById(subjectId, { includeDeleted })
    if (!subject) {
      throw SubjectNotFoundException
    }

    return subject
  }

  async getAvailableTrainers(courseId: CourseIdParamsType): Promise<GetAvailableTrainersResType> {
    const trainers = await this.subjectRepo.getAvailableTrainers(courseId)

    return trainers
  }

  async create({
    data: subject,
    createdById
  }: {
    data: CreateSubjectBodyType
    createdById: string
  }): Promise<SubjectType> {
    try {
      const course = await this.sharedCourseRepository.findById(subject.courseId)
      if (!course) {
        throw CourseNotFoundException
      }

      this.validateSubjectDatesWithinCourse(subject.startDate, subject.endDate, course.startDate, course.endDate)

      const durationInMonths = this.calculateDuration(subject.startDate, subject.endDate)

      const createdSubject = await this.subjectRepo.create({
        data: { ...subject, duration: durationInMonths },
        createdById
      })

      return createdSubject
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

  @Serialize()
  async bulkCreate({
    data,
    createdById
  }: {
    data: BulkCreateSubjectsBodyType
    createdById: string
  }): Promise<BulkCreateSubjectsResType> {
    const { courseId, subjects } = data

    const course = await this.sharedCourseRepository.findById(courseId)
    if (!course) {
      throw CourseNotFoundException
    }

    const createdSubjects: SubjectType[] = []
    const failedSubjects: { subject: Omit<CreateSubjectBodyType, 'courseId'>; error: string }[] = []

    // Xử lý từng subject
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i]

      try {
        const codeExists = await this.sharedSubjectRepository.checkCodeExists(subject.code)
        if (codeExists) {
          throw BulkSubjectCodeAlreadyExistsAtIndexException(i, subject.code)
        }

        this.validateSubjectDatesWithinCourse(subject.startDate, subject.endDate, course.startDate, course.endDate)

        const durationInMonths = this.calculateDuration(subject.startDate, subject.endDate)

        const createdSubject = await this.subjectRepo.create({
          data: { ...subject, courseId, duration: durationInMonths },
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

  async update({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateSubjectBodyType
    updatedById: string
  }): Promise<GetSubjectDetailResType> {
    try {
      const existingSubject = await this.sharedSubjectRepository.findById(id)
      if (!existingSubject) {
        throw SubjectNotFoundException
      }
      let course = null
      const existingCourseId = existingSubject.courseId
      const finalCourseId = data.courseId || existingCourseId
      if (data.courseId && data.courseId !== existingCourseId) {
        course = await this.sharedCourseRepository.findById(data.courseId)
        if (!course) {
          throw CourseNotFoundException
        }
      } else {
        // Lấy course hiện tại nếu không thay đổi nhưng có thay đổi dates
        if ((data.startDate || data.endDate) && finalCourseId) {
          course = await this.sharedCourseRepository.findById(finalCourseId)
        }
      }

      // Validate subject code unique nếu thay đổi
      if (data.code && data.code !== existingSubject.code) {
        const codeExists = await this.sharedSubjectRepository.checkCodeExists(data.code, id)
        if (codeExists) {
          throw SubjectCodeAlreadyExistsException
        }
      }

      // Validate date range
      const startDate = data.startDate || existingSubject.startDate
      const endDate = data.endDate || existingSubject.endDate

      // Validate subject dates nằm trong course dates (nếu có course)
      if (course) {
        this.validateSubjectDatesWithinCourse(startDate, endDate, course.startDate, course.endDate)
      }

      // Tính lại duration nếu dates thay đổi
      const updatedData: UpdateSubjectBodyType & { duration?: number } = { ...data }
      if (data.startDate || data.endDate) {
        const durationInMonths = this.calculateDuration(startDate, endDate)
        updatedData.duration = durationInMonths
      }

      const updatedSubject = await this.subjectRepo.update({ id, data: updatedData, updatedById })
      const result = await this.subjectRepo.findById(updatedSubject.id, { includeDeleted: true })
      if (!result) {
        throw SubjectNotFoundException
      }
      return result
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

  async archive({ id, archivedById }: { id: string; archivedById: string }): Promise<string> {
    const existingSubject = await this.sharedSubjectRepository.findById(id)
    if (!existingSubject) {
      throw SubjectNotFoundException
    }

    await this.subjectRepo.archive({
      id,
      archivedById
    })

    return 'Archived subject successfully'
  }

  async assignTrainer({
    subjectId,
    data
  }: {
    subjectId: string
    data: AssignTrainerBodyType
  }): Promise<AssignTrainerResType> {
    const subject = await this.sharedSubjectRepository.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    const exists = await this.subjectRepo.isTrainerAssignedToSubject({
      subjectId,
      trainerUserId: data.trainerUserId
    })

    if (exists) {
      throw DuplicateInstructorException
    }

    const assignment = await this.subjectRepo.assignTrainerToSubject({
      subjectId,
      trainerUserId: data.trainerUserId,
      roleInSubject: data.roleInSubject
    })

    return assignment
  }

  async updateTrainerAssignment({
    currentSubjectId,
    currentTrainerId,
    data
  }: {
    currentSubjectId: string
    currentTrainerId: string
    data: { roleInSubject: SubjectInstructorRoleValue }
  }): Promise<UpdateTrainerAssignmentResType> {
    const exists = await this.subjectRepo.isTrainerAssignedToSubject({
      subjectId: currentSubjectId,
      trainerUserId: currentTrainerId
    })

    if (!exists) {
      throw TrainerAssignmentNotFoundException
    }

    const updated = await this.subjectRepo.updateTrainerAssignment({
      currentSubjectId,
      currentTrainerId,
      newRoleInSubject: data.roleInSubject
    })

    return updated
  }

  async removeTrainer({ subjectId, trainerId }: { subjectId: string; trainerId: string }): Promise<string> {
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

    return 'Trainer removed successfully'
  }
  async lookupTrainees({ data }: { data: LookupTraineesBodyType }): Promise<LookupTraineesResType> {
    const result = await this.subjectRepo.lookupTrainees({
      trainees: data.traineesList
    })

    return {
      foundUsers: result.foundUsers,
      notFoundIdentifiers: result.notFoundIdentifiers
    }
  }

  async assignTraineesToSubject({
    subjectId,
    data
  }: {
    subjectId: string
    data: AssignTraineesBodyType
  }): Promise<AssignTraineesResType> {
    const subject = await this.sharedSubjectRepository.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }
    // Validation 1: Check course max trainee limit
    if (subject.courseId) {
      const { current, max } = await this.subjectRepo.getCourseTraineeCount(subject.courseId)

      if (max !== null && current + data.traineeUserIds.length > max) {
        throw CourseAtCapacityException(current, max, data.traineeUserIds.length)
      }
    }

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
   * Xóa enrollments từ subject.
   * - Chỉ ACADEMIC_DEPARTMENT mới có quyền
   */
  async removeEnrollments({ subjectId, data }: { subjectId: string; data: any }): Promise<any> {
    // Kiểm tra quyền

    // Kiểm tra subject tồn tại
    const subject = await this.sharedSubjectRepository.findById(subjectId)
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
   * Validate subject dates phải nằm trong khoảng course dates
   */
  private validateSubjectDatesWithinCourse(
    subjectStartDate: Date,
    subjectEndDate: Date,
    courseStartDate: Date,
    courseEndDate: Date
  ): void {
    const subStart = new Date(subjectStartDate)
    const subEnd = new Date(subjectEndDate)
    const courStart = new Date(courseStartDate)
    const courEnd = new Date(courseEndDate)

    if (subStart < courStart || subEnd > courEnd) {
      throw SubjectDateOutsideCourseDateRangeException
    }
  }

  /**
   * Tính duration (số tháng) dựa trên (endDate - startDate) / 30 ngày
   * Trả về số thập phân với 2 chữ số
   */
  private calculateDuration(startDate: Date, endDate: Date): number {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffInMs = end.getTime() - start.getTime()
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24)
    return round(diffInDays / 30, 2)
  }

  /**
   * Cancel all course enrollments for a trainee in a batch
   */

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

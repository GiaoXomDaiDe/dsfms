import { Injectable } from '@nestjs/common'
import { round } from 'lodash'
import { SubjectInstructorRoleValue, SubjectStatus, SubjectStatusValue } from '~/shared/constants/subject.constant'
import { Serialize } from '~/shared/decorators/serialize.decorator'
import {
  isForeignKeyConstraintPrismaError,
  isNotFoundPrismaError,
  isUniqueConstraintPrismaError
} from '~/shared/helper'
import { MessageResType } from '~/shared/models/response.model'
import { SubjectIdParamsType, SubjectType } from '~/shared/models/shared-subject.model'
import { SharedCourseRepository } from '~/shared/repositories/shared-course.repo'
import { SharedSubjectRepository } from '~/shared/repositories/shared-subject.repo'
import {
  BulkSubjectCodeAlreadyExistsAtIndexException,
  BulkSubjectCreationFailedException,
  CannotCancelSubjectEnrollmentException,
  CourseAtCapacityException,
  CourseNotFoundException,
  DuplicateInstructorException,
  DuplicateTraineeEnrollmentException,
  InvalidTraineeSubmissionException,
  SubjectAlreadyArchivedException,
  SubjectCannotAssignTrainerFromCurrentStatusException,
  SubjectCannotBeArchivedFromCurrentStatusException,
  SubjectCannotRemoveTrainerFromCurrentStatusException,
  SubjectCannotUpdateTrainerAssignmentFromCurrentStatusException,
  SubjectCodeAlreadyExistsException,
  SubjectDatesOutsideCourseRangeException,
  SubjectEnrollmentWindowClosedException,
  SubjectNotFoundException,
  TrainerAssignmentNotFoundException
} from './subject.error'
import { SubjectMes } from './subject.message'
import {
  AssignTraineesBodyType,
  AssignTraineesResType,
  AssignTrainerBodyType,
  AssignTrainerResType,
  BulkCreateSubjectsBodyType,
  BulkCreateSubjectsResType,
  CancelSubjectEnrollmentBodyType,
  CreateSubjectBodyType,
  GetActiveTraineesResType,
  GetAvailableTrainersResType,
  GetSubjectDetailResType,
  GetSubjectsQueryType,
  GetSubjectsResType,
  GetTraineeCourseSubjectsResType,
  GetTraineeEnrollmentsQueryType,
  GetTraineeEnrollmentsResType,
  LookupTraineesBodyType,
  LookupTraineesResType,
  RemoveCourseEnrollmentsByBatchResType,
  RemoveCourseTraineeEnrollmentsBodyType,
  RemoveCourseTraineeEnrollmentsResType,
  RemoveEnrollmentsBodyType,
  RemoveEnrollmentsResType,
  UpdateSubjectBodyType,
  UpdateTrainerAssignmentResType
} from './subject.model'
import { SubjectRepository } from './subject.repo'

@Injectable()
export class SubjectService {
  constructor(
    private readonly subjectRepo: SubjectRepository,
    private readonly sharedSubjectRepo: SharedSubjectRepository,
    private readonly sharedCourseRepo: SharedCourseRepository
  ) {}

  async list(query: GetSubjectsQueryType): Promise<GetSubjectsResType> {
    return await this.subjectRepo.list({
      ...query
    })
  }

  async findById(subjectId: SubjectIdParamsType): Promise<GetSubjectDetailResType> {
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    return subject
  }

  async getActiveTrainers(): Promise<GetAvailableTrainersResType> {
    const trainers = await this.subjectRepo.findActiveTrainers()

    return trainers
  }

  async getActiveTrainees(): Promise<GetActiveTraineesResType> {
    return await this.subjectRepo.findActiveTrainees()
  }

  async create({
    data: subject,
    createdById
  }: {
    data: CreateSubjectBodyType
    createdById: string
  }): Promise<SubjectType> {
    try {
      const course = await this.sharedCourseRepo.findById(subject.courseId)
      if (!course) {
        throw CourseNotFoundException
      }

      this.ensureSubjectWithinCourseRange({
        courseId: course.id,
        courseStartDate: course.startDate,
        courseEndDate: course.endDate,
        subjectStartDate: subject.startDate,
        subjectEndDate: subject.endDate
      })

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

    const course = await this.sharedCourseRepo.findById(courseId)
    if (!course) {
      throw CourseNotFoundException
    }

    const createdSubjects: SubjectType[] = []
    const failedSubjects: { subject: Omit<CreateSubjectBodyType, 'courseId'>; error: string }[] = []

    // Xử lý từng subject
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i]

      try {
        const codeExists = await this.sharedSubjectRepo.checkCodeExists(subject.code, courseId)
        if (codeExists) {
          throw BulkSubjectCodeAlreadyExistsAtIndexException(i, subject.code)
        }

        this.ensureSubjectWithinCourseRange({
          courseId: course.id,
          courseStartDate: course.startDate,
          courseEndDate: course.endDate,
          subjectStartDate: subject.startDate,
          subjectEndDate: subject.endDate
        })

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
      const existingSubject = await this.sharedSubjectRepo.findById(id)
      if (!existingSubject) {
        throw SubjectNotFoundException
      }
      let course = null
      const existingCourseId = existingSubject.courseId
      const finalCourseId = data.courseId || existingCourseId
      if (data.courseId && data.courseId !== existingCourseId) {
        course = await this.sharedCourseRepo.findById(data.courseId)
        if (!course) {
          throw CourseNotFoundException
        }
      } else {
        // Lấy course hiện tại nếu không thay đổi nhưng có thay đổi dates
        if ((data.startDate || data.endDate) && finalCourseId) {
          course = await this.sharedCourseRepo.findById(finalCourseId)
        }
      }

      // Validate subject code unique nếu thay đổi
      if (data.code && data.code !== existingSubject.code) {
        const codeExists = await this.sharedSubjectRepo.checkCodeExists(data.code, finalCourseId, id)
        if (codeExists) {
          throw SubjectCodeAlreadyExistsException
        }
      }

      // Validate date range
      const startDate = data.startDate || existingSubject.startDate
      const endDate = data.endDate || existingSubject.endDate

      // Tính lại duration nếu dates thay đổi
      const updatedData: UpdateSubjectBodyType & { duration?: number } = { ...data }
      if (data.startDate || data.endDate) {
        const durationInMonths = this.calculateDuration(startDate, endDate)
        updatedData.duration = durationInMonths
      }

      if (course) {
        this.ensureSubjectWithinCourseRange({
          courseId: course.id,
          courseStartDate: course.startDate,
          courseEndDate: course.endDate,
          subjectStartDate: startDate,
          subjectEndDate: endDate
        })
      }

      const updatedSubject = await this.subjectRepo.update({ id, data: updatedData, updatedById })
      const result = await this.subjectRepo.findById(updatedSubject.id)
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

  async archive({ id, archivedById }: { id: string; archivedById: string }): Promise<MessageResType> {
    const existingSubject = await this.sharedSubjectRepo.findById(id)
    if (!existingSubject) {
      throw SubjectNotFoundException
    }

    const subjectStatus = existingSubject.status as string

    if (subjectStatus === SubjectStatus.ARCHIVED) {
      throw SubjectAlreadyArchivedException
    }

    if (subjectStatus !== SubjectStatus.PLANNED && subjectStatus !== SubjectStatus.ON_GOING) {
      throw SubjectCannotBeArchivedFromCurrentStatusException
    }

    await this.subjectRepo.archive({
      id,
      archivedById,
      status: subjectStatus
    })

    return { message: SubjectMes.ARCHIVE_SUCCESS }
  }

  async assignTrainer({
    subjectId,
    data
  }: {
    subjectId: string
    data: AssignTrainerBodyType
  }): Promise<AssignTrainerResType> {
    const subject = await this.sharedSubjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    if (!this.isTrainerMutationAllowed(subject.status as SubjectStatusValue)) {
      throw SubjectCannotAssignTrainerFromCurrentStatusException
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
    const subject = await this.sharedSubjectRepo.findById(currentSubjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    if (!this.isTrainerMutationAllowed(subject.status as SubjectStatusValue)) {
      throw SubjectCannotUpdateTrainerAssignmentFromCurrentStatusException
    }

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

  async removeTrainer({ subjectId, trainerId }: { subjectId: string; trainerId: string }): Promise<MessageResType> {
    const subject = await this.sharedSubjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    if (!this.isTrainerMutationAllowed(subject.status as SubjectStatusValue)) {
      throw SubjectCannotRemoveTrainerFromCurrentStatusException
    }

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

    return { message: SubjectMes.REMOVE_TRAINER_SUCCESS }
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
    const subject = await this.sharedSubjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    if (subject.startDate) {
      const now = new Date()
      const startDate = new Date(subject.startDate)

      if (now >= startDate) {
        throw SubjectEnrollmentWindowClosedException(subject.startDate)
      }
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
        fullName: item.fullName,
        email: item.email,
        batchCode: item.batchCode,
        enrolledAt: item.enrolledAt
      }))

      throw DuplicateTraineeEnrollmentException({
        duplicates: duplicateDetails,
        subjectName: subject.name,
        subjectCode: subject.code
      })
    }

    if (result.invalid.length > 0) {
      throw InvalidTraineeSubmissionException(result.invalid)
    }

    return {
      enrolledCount: result.enrolled.length,
      enrolled: result.enrolled
    }
  }

  async getTraineeEnrollments({
    traineeId,
    query,
    courseId
  }: {
    traineeId: string
    query: GetTraineeEnrollmentsQueryType
    courseId?: string
  }): Promise<GetTraineeEnrollmentsResType> {
    const { batchCode, status } = query

    const result = await this.subjectRepo.getTraineeEnrollments({
      traineeUserId: traineeId,
      batchCode,
      status,
      courseId
    })

    return {
      trainee: result.trainee,
      enrollments: result.enrollments,
      totalCount: result.enrollments.length
    }
  }

  async getTraineeCourseSubjects(traineeId: string): Promise<GetTraineeCourseSubjectsResType> {
    return await this.subjectRepo.getTraineeCoursesWithSubjects({
      traineeUserId: traineeId
    })
  }

  async removeEnrollments({
    subjectId,
    data
  }: {
    subjectId: string
    data: RemoveEnrollmentsBodyType
  }): Promise<RemoveEnrollmentsResType> {
    // Kiểm tra subject tồn tại
    const subject = await this.sharedSubjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

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

  async removeCourseEnrollmentsByBatch({
    courseId,
    batchCode
  }: {
    courseId: string
    batchCode: string
  }): Promise<RemoveCourseEnrollmentsByBatchResType> {
    const exists = await this.sharedCourseRepo.exists(courseId)
    if (!exists) {
      throw CourseNotFoundException
    }

    const result = await this.subjectRepo.removeCourseEnrollmentsByBatch({
      courseId,
      batchCode
    })

    const message =
      result.removedCount > 0
        ? `Removed ${result.removedCount} enrollments from batch ${batchCode} across ${result.removedSubjects.length} subject(s)`
        : `No enrollments found for batch ${batchCode} in this course`

    return {
      courseId,
      batchCode,
      removedCount: result.removedCount,
      removedSubjects: result.removedSubjects,
      message
    }
  }

  async cancelSubjectEnrollment({
    subjectId,
    traineeId,
    data
  }: {
    subjectId: string
    traineeId: string
    data: CancelSubjectEnrollmentBodyType
  }): Promise<MessageResType> {
    const success = await this.subjectRepo.cancelSubjectEnrollment({
      subjectId,
      traineeUserId: traineeId,
      batchCode: data.batchCode
    })

    if (!success) {
      throw CannotCancelSubjectEnrollmentException
    }

    return { message: SubjectMes.CANCEL_ENROLLMENT_SUCCESS }
  }

  async removeCourseEnrollmentsForTrainee({
    data
  }: {
    data: RemoveCourseTraineeEnrollmentsBodyType
  }): Promise<RemoveCourseTraineeEnrollmentsResType> {
    const result = await this.subjectRepo.removeCourseEnrollmentsForTrainee({
      traineeEid: data.traineeEid,
      courseCode: data.courseCode
    })

    const message =
      result.removedEnrollmentsCount > 0
        ? `Removed ${result.removedEnrollmentsCount} enrollments for trainee ${data.traineeEid} from course ${data.courseCode}`
        : 'No enrollments found for this trainee in the course'

    return {
      message,
      removedEnrollmentsCount: result.removedEnrollmentsCount,
      affectedSubjectCodes: result.affectedSubjectCodes
    }
  }

  private ensureSubjectWithinCourseRange({
    courseId,
    courseStartDate,
    courseEndDate,
    subjectStartDate,
    subjectEndDate
  }: {
    courseId: string
    courseStartDate: Date
    courseEndDate: Date
    subjectStartDate: Date
    subjectEndDate: Date
  }): void {
    const subjectStart = new Date(subjectStartDate)
    const subjectEnd = new Date(subjectEndDate)
    const courseStart = new Date(courseStartDate)
    const courseEnd = new Date(courseEndDate)

    if (subjectStart < courseStart || subjectEnd > courseEnd) {
      throw SubjectDatesOutsideCourseRangeException({
        courseId,
        courseStart,
        courseEnd,
        subjectStart,
        subjectEnd
      })
    }
  }

  private calculateDuration(startDate: Date, endDate: Date): number {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffInMs = end.getTime() - start.getTime()
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24)
    return round(diffInDays / 30, 2)
  }

  private isTrainerMutationAllowed(status: SubjectStatusValue): boolean {
    return status === SubjectStatus.PLANNED || status === SubjectStatus.ON_GOING
  }
}

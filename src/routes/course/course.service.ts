import { Injectable } from '@nestjs/common'
import {
  GetCourseEnrollmentBatchesResType,
  GetTraineeEnrollmentsQueryType,
  GetTraineeEnrollmentsResType,
  RemoveCourseEnrollmentsByBatchResType
} from '~/routes/subject/subject.model'
import { RoleName } from '~/shared/constants/auth.constant'
import { CourseStatus } from '~/shared/constants/course.constant'
import { isUniqueConstraintPrismaError } from '~/shared/helper'
import { MessageResType } from '~/shared/models/response.model'
import { SharedDepartmentRepository } from '~/shared/repositories/shared-department.repo'
import { SubjectService } from '../subject/subject.service'
import {
  CourseAlreadyArchivedException,
  CourseCannotBeArchivedFromCurrentStatusException,
  CourseCodeAlreadyExistsException,
  CourseDateRangeViolationException,
  CourseNotFoundException,
  CourseTrainerAlreadyAssignedException,
  CourseTrainerAssignmentNotFoundException,
  DepartmentNotFoundException,
  OnlyAcademicDepartmentCanDeleteCourseException,
  OnlyAcademicDepartmentCanUpdateCourseException
} from './course.error'
import {
  AssignCourseTrainerBodyType,
  AssignCourseTrainerResType,
  CreateCourseBodyType,
  CreateCourseResType,
  GetCourseParamsType,
  GetCourseResType,
  GetCoursesResType,
  GetCourseTraineesQueryType,
  GetCourseTraineesResType,
  UpdateCourseBodyType,
  UpdateCourseResType,
  UpdateCourseTrainerAssignmentBodyType,
  UpdateCourseTrainerAssignmentResType
} from './course.model'
import { CourseRepository } from './course.repo'

@Injectable()
export class CourseService {
  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly sharedDepartmentRepo: SharedDepartmentRepository,
    private readonly subjectService: SubjectService
  ) {}

  async list(): Promise<GetCoursesResType> {
    return await this.courseRepo.list()
  }

  async findById(id: string): Promise<GetCourseResType> {
    const course = await this.courseRepo.findById(id)
    if (!course) {
      throw CourseNotFoundException
    }
    return course
  }

  async create({
    data,
    createdById
  }: {
    data: CreateCourseBodyType
    createdById: string
  }): Promise<CreateCourseResType> {
    const isActiveDept = await this.sharedDepartmentRepo.exists(data.departmentId)

    if (!isActiveDept) {
      throw DepartmentNotFoundException
    }

    try {
      return await this.courseRepo.create({ data, createdById })
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw CourseCodeAlreadyExistsException
      }

      throw error
    }
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
  }): Promise<UpdateCourseResType> {
    const existingCourse = await this.courseRepo.findById(id)
    if (!existingCourse) {
      throw CourseNotFoundException
    }

    if (updatedByRoleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAcademicDepartmentCanUpdateCourseException
    }

    if (data.departmentId && data.departmentId !== existingCourse.departmentId) {
      const department = await this.sharedDepartmentRepo.findActiveDepartmentById(data.departmentId)

      if (!department) {
        throw DepartmentNotFoundException
      }
    }

    if (existingCourse.subjects && existingCourse.subjects.length > 0) {
      const newCourseStart = data.startDate ?? existingCourse.startDate
      const newCourseEnd = data.endDate ?? existingCourse.endDate

      const violations = existingCourse.subjects.filter((subject) => {
        const outsideStartDate = newCourseStart && subject.startDate < newCourseStart
        const outsideEndDate = newCourseEnd && subject.endDate > newCourseEnd
        return outsideStartDate || outsideEndDate
      })

      if (violations.length > 0) {
        throw CourseDateRangeViolationException(
          violations.map((item) => ({
            subjectId: item.id,
            subjectName: item.name,
            subjectStart: item.startDate,
            subjectEnd: item.endDate
          }))
        )
      }
    }

    try {
      return await this.courseRepo.update({ id, data, updatedById })
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw CourseCodeAlreadyExistsException
      }

      throw error
    }
  }

  async archive({
    id,
    deletedById,
    deletedByRoleName
  }: {
    id: string
    deletedById: string
    deletedByRoleName: string
  }): Promise<MessageResType> {
    const existingCourse = await this.courseRepo.findById(id)
    if (!existingCourse) {
      throw CourseNotFoundException
    }

    if (deletedByRoleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAcademicDepartmentCanDeleteCourseException
    }

    const courseStatus = existingCourse.status as string

    if (courseStatus === CourseStatus.ARCHIVED) {
      throw CourseAlreadyArchivedException
    }

    if (courseStatus !== CourseStatus.PLANNED && courseStatus !== CourseStatus.ON_GOING) {
      throw CourseCannotBeArchivedFromCurrentStatusException
    }

    await this.courseRepo.archive({ id, deletedById, status: courseStatus })

    return { message: 'Course archived successfully' }
  }

  async getCourseTrainees({
    params,
    query
  }: {
    params: GetCourseParamsType
    query: GetCourseTraineesQueryType
  }): Promise<GetCourseTraineesResType> {
    const { courseId } = params

    const course = await this.courseRepo.findById(courseId)
    if (!course) {
      throw CourseNotFoundException
    }

    return await this.courseRepo.getCourseTrainees({
      courseId,
      batchCode: query.batchCode
    })
  }

  async cancelCourseEnrollments({
    params,
    traineeId,
    data
  }: {
    params: GetCourseParamsType
    traineeId: string
    data: any
  }): Promise<any> {
    const { courseId } = params

    const result = await this.courseRepo.cancelCourseEnrollments({
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

  async assignTrainerToCourse({
    courseId,
    data
  }: {
    courseId: string
    data: AssignCourseTrainerBodyType
  }): Promise<AssignCourseTrainerResType> {
    const course = await this.courseRepo.findById(courseId)

    if (!course) {
      throw CourseNotFoundException
    }

    const exists = await this.courseRepo.isTrainerAssignedToCourse({
      courseId,
      trainerUserId: data.trainerUserId
    })

    if (exists) {
      throw CourseTrainerAlreadyAssignedException
    }

    try {
      return await this.courseRepo.assignTrainerToCourse({
        courseId,
        trainerUserId: data.trainerUserId,
        roleInSubject: data.roleInSubject
      })
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw CourseTrainerAlreadyAssignedException
      }

      throw error
    }
  }

  async updateCourseTrainerAssignment({
    courseId,
    trainerId,
    data
  }: {
    courseId: string
    trainerId: string
    data: UpdateCourseTrainerAssignmentBodyType
  }): Promise<UpdateCourseTrainerAssignmentResType> {
    const exists = await this.courseRepo.isTrainerAssignedToCourse({
      courseId,
      trainerUserId: trainerId
    })

    if (!exists) {
      throw CourseTrainerAssignmentNotFoundException
    }

    return await this.courseRepo.updateCourseTrainerAssignment({
      courseId,
      trainerUserId: trainerId,
      newRoleInSubject: data.roleInSubject
    })
  }

  async removeTrainerFromCourse({
    courseId,
    trainerId
  }: {
    courseId: string
    trainerId: string
  }): Promise<MessageResType> {
    const exists = await this.courseRepo.isTrainerAssignedToCourse({
      courseId,
      trainerUserId: trainerId
    })

    if (!exists) {
      throw CourseTrainerAssignmentNotFoundException
    }

    await this.courseRepo.removeTrainerFromCourse({
      courseId,
      trainerUserId: trainerId
    })

    return { message: 'Trainer removed successfully' }
  }

  async getCourseEnrollmentBatches({ courseId }: { courseId: string }): Promise<GetCourseEnrollmentBatchesResType> {
    return await this.subjectService.getCourseEnrollmentBatches({ courseId })
  }

  async removeCourseEnrollmentsByBatch({
    courseId,
    batchCode
  }: {
    courseId: string
    batchCode: string
  }): Promise<RemoveCourseEnrollmentsByBatchResType> {
    return await this.subjectService.removeCourseEnrollmentsByBatch({
      courseId,
      batchCode
    })
  }

  async getTraineeEnrollments({
    traineeId,
    query
  }: {
    traineeId: string
    query: GetTraineeEnrollmentsQueryType
  }): Promise<GetTraineeEnrollmentsResType> {
    return await this.subjectService.getTraineeEnrollments({
      traineeId,
      query
    })
  }
}

import { BadRequestException, Injectable } from '@nestjs/common'
import {
  GetCourseEnrollmentBatchesResType,
  GetTraineeEnrollmentsQueryType,
  GetTraineeEnrollmentsResType,
  RemoveCourseEnrollmentsByBatchResType
} from '~/routes/subject/subject.model'
import { CourseStatus } from '~/shared/constants/course.constant'
import { isUniqueConstraintPrismaError } from '~/shared/helper'
import { MessageResType } from '~/shared/models/response.model'
import { SharedDepartmentRepository } from '~/shared/repositories/shared-department.repo'
import { SubjectService } from '../subject/subject.service'
import {
  CourseCannotAssignTrainerFromCurrentStatusException,
  CourseCannotBeArchivedFromCurrentStatusException,
  CourseCannotUpdateTrainerRoleFromCurrentStatusException,
  CourseCodeAlreadyExistsException,
  CourseDateRangeViolationException,
  CourseNotFoundException,
  CourseTrainerAlreadyAssignedException,
  CourseTrainerAssignmentNotFoundException,
  DepartmentNotFoundException
} from './course.error'
import {
  AssignCourseTrainerBodyType,
  AssignCourseTrainerResType,
  CreateCourseBodyType,
  CreateCourseResType,
  GetCourseParamsType,
  GetCourseResType,
  GetCoursesResType,
  GetCourseTraineeEnrollmentsQueryType,
  GetCourseTraineeEnrollmentsResType,
  GetCourseTraineesQueryType,
  GetCourseTraineesResType,
  UpdateCourseBodyType,
  UpdateCourseResType,
  UpdateCourseTrainerRoleBodyType,
  UpdateCourseTrainerRoleResType
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
    updatedById
  }: {
    id: string
    data: UpdateCourseBodyType
    updatedById: string
  }): Promise<UpdateCourseResType> {
    const existingCourse = await this.courseRepo.findById(id)
    if (!existingCourse) {
      throw CourseNotFoundException
    }
    // 1) Nếu đổi department → validate department mới
    if (data.departmentId && data.departmentId !== existingCourse.departmentId) {
      const isActiveDept = await this.sharedDepartmentRepo.exists(data.departmentId)

      if (!isActiveDept) {
        throw DepartmentNotFoundException
      }
    }

    // 2) Tính khoảng ngày mới của course (kết hợp dữ liệu cũ + dữ liệu mới)
    const newCourseStart = data.startDate ?? existingCourse.startDate
    const newCourseEnd = data.endDate ?? existingCourse.endDate

    if (newCourseStart && newCourseEnd && newCourseStart > newCourseEnd) {
      throw new BadRequestException('End date must be after start date')
    }

    if (existingCourse.subjects && existingCourse.subjects.length > 0) {
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

  async archive({ id, deletedById }: { id: string; deletedById: string }): Promise<MessageResType> {
    const existingCourse = await this.courseRepo.findById(id)
    if (!existingCourse) {
      throw CourseNotFoundException
    }

    const courseStatus = existingCourse.status

    if (courseStatus !== CourseStatus.PLANNED && courseStatus !== CourseStatus.ON_GOING) {
      throw CourseCannotBeArchivedFromCurrentStatusException
    }

    await this.courseRepo.archive({ id, deletedById, status: courseStatus })

    return { message: 'Course archived successfully' }
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
    if (course.status !== CourseStatus.PLANNED && course.status !== CourseStatus.ON_GOING) {
      throw CourseCannotAssignTrainerFromCurrentStatusException
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

  async updateCourseTrainerRole({
    courseId,
    trainerId,
    data
  }: {
    courseId: string
    trainerId: string
    data: UpdateCourseTrainerRoleBodyType
  }): Promise<UpdateCourseTrainerRoleResType> {
    const course = await this.courseRepo.findById(courseId)
    if (!course) throw CourseNotFoundException

    if (course.status !== CourseStatus.PLANNED && course.status !== CourseStatus.ON_GOING) {
      throw CourseCannotUpdateTrainerRoleFromCurrentStatusException
    }
    const exists = await this.courseRepo.isTrainerAssignedToCourse({
      courseId,
      trainerUserId: trainerId
    })

    if (!exists) {
      throw CourseTrainerAssignmentNotFoundException
    }

    return await this.courseRepo.updateCourseTrainerRole({
      courseId,
      trainerUserId: trainerId,
      newRoleInSubject: data.roleInSubject
    })
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

  async getCourseTraineeEnrollments({
    courseId,
    query
  }: {
    courseId: string
    query: GetCourseTraineeEnrollmentsQueryType
  }): Promise<GetCourseTraineeEnrollmentsResType> {
    const course = await this.courseRepo.findById(courseId)
    if (!course) {
      throw CourseNotFoundException
    }

    return await this.courseRepo.getCourseTraineeEnrollments({
      courseId,
      batchCode: query.batchCode,
      status: query.status
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

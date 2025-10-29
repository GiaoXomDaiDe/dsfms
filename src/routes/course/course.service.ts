import { Injectable } from '@nestjs/common'
import { RoleName } from '~/shared/constants/auth.constant'
import { CourseStatus } from '~/shared/constants/course.constant'
import { isUniqueConstraintPrismaError } from '~/shared/helper'
import { MessageResType } from '~/shared/models/response.model'
import { SharedDepartmentRepository } from '~/shared/repositories/shared-department.repo'
import {
  CourseAlreadyArchivedException,
  CourseCannotBeArchivedFromCurrentStatusException,
  CourseCodeAlreadyExistsException,
  CourseDateRangeViolationException,
  CourseNotFoundException,
  DepartmentNotFoundException,
  OnlyAcademicDepartmentCanCreateCourseException,
  OnlyAcademicDepartmentCanDeleteCourseException,
  OnlyAcademicDepartmentCanUpdateCourseException
} from './course.error'
import {
  CreateCourseBodyType,
  CreateCourseResType,
  GetCourseParamsType,
  GetCourseResType,
  GetCoursesQueryType,
  GetCoursesResType,
  GetCourseTraineesQueryType,
  GetCourseTraineesResType,
  UpdateCourseBodyType,
  UpdateCourseResType
} from './course.model'
import { CourseRepo } from './course.repo'

@Injectable()
export class CourseService {
  constructor(
    private readonly courseRepo: CourseRepo,
    private readonly sharedDepartmentRepo: SharedDepartmentRepository
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
    createdByRoleName
  }: {
    data: CreateCourseBodyType
    createdById: string
    createdByRoleName: string
  }): Promise<CreateCourseResType> {
    if (createdByRoleName !== RoleName.ACADEMIC_DEPARTMENT) {
      throw OnlyAcademicDepartmentCanCreateCourseException
    }

    const department = await this.sharedDepartmentRepo.findById(data.departmentId, {
      includeDeleted: false
    })

    if (!department) {
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
      const department = await this.sharedDepartmentRepo.findById(data.departmentId, {
        includeDeleted: false
      })

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
}

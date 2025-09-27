import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { RoleName } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  AddInstructorsBodyType,
  CreateSubjectBodyType,
  EnrollTraineesBodyType,
  GetSubjectsQueryType,
  GetSubjectsResType,
  SubjectDetailResType,
  SubjectEntityType,
  SubjectStatsType,
  SubjectWithInfoType,
  UpdateEnrollmentStatusBodyType,
  UpdateSubjectBodyType
} from './subject.model'
import { SubjectRepo } from './subject.repo'

// Custom exceptions
export const SubjectNotFoundException = new NotFoundException('Subject not found')
export const SubjectCodeAlreadyExistsException = new BadRequestException('Subject code already exists')
export const CourseNotFoundException = new NotFoundException('Course not found')
export const InvalidDateRangeException = new BadRequestException('End date must be after start date')
export const TrainerNotFoundException = new BadRequestException(
  'One or more trainers not found or do not have TRAINER role'
)
export const TraineeNotFoundException = new BadRequestException(
  'One or more trainees not found or do not have TRAINEE role'
)

@Injectable()
export class SubjectService {
  constructor(
    private readonly subjectRepo: SubjectRepo,
    private readonly prisma: PrismaService
  ) {}

  async list(query: GetSubjectsQueryType): Promise<GetSubjectsResType> {
    return await this.subjectRepo.list(query)
  }

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

  async create({
    data,
    createdById,
    createdByRoleName
  }: {
    data: CreateSubjectBodyType
    createdById: string
    createdByRoleName: string
  }): Promise<SubjectEntityType> {
    // Validate permissions - only ADMIN and DEPARTMENT_HEAD can create subjects
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(createdByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can create subjects')
    }

    // Validate course exists
    const course = await this.prisma.course.findUnique({
      where: { id: data.courseId, deletedAt: null },
      include: { department: true }
    })

    if (!course) {
      throw CourseNotFoundException
    }

    // If user is DEPARTMENT_HEAD, validate they can only create subjects in courses of their department
    if (createdByRoleName === RoleName.DEPARTMENT_HEAD) {
      const creator = await this.prisma.user.findUnique({
        where: { id: createdById },
        select: { departmentId: true }
      })

      if (!creator?.departmentId || creator.departmentId !== course.departmentId) {
        throw new ForbiddenException('Department heads can only create subjects in courses of their own department')
      }
    }

    // Validate subject code is unique
    const codeExists = await this.subjectRepo.checkCodeExists(data.code)
    if (codeExists) {
      throw SubjectCodeAlreadyExistsException
    }

    // Validate date range if both dates are provided
    if (data.startDate && data.endDate) {
      if (new Date(data.startDate) >= new Date(data.endDate)) {
        throw InvalidDateRangeException
      }
    }

    return await this.subjectRepo.create({ data, createdById })
  }

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
    // Check if subject exists
    const existingSubject = await this.subjectRepo.findById(id)
    if (!existingSubject) {
      throw SubjectNotFoundException
    }

    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(updatedByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can update subjects')
    }

    // If user is DEPARTMENT_HEAD, validate they can only update subjects in courses of their department
    if (updatedByRoleName === RoleName.DEPARTMENT_HEAD) {
      const updater = await this.prisma.user.findUnique({
        where: { id: updatedById },
        select: { departmentId: true }
      })

      const targetCourseId = data.courseId || existingSubject.courseId
      const targetCourse = await this.prisma.course.findUnique({
        where: { id: targetCourseId },
        select: { departmentId: true }
      })

      if (!updater?.departmentId || !targetCourse || updater.departmentId !== targetCourse.departmentId) {
        throw new ForbiddenException('Department heads can only update subjects in courses of their own department')
      }
    }

    // Validate new course exists if changing course
    if (data.courseId && data.courseId !== existingSubject.courseId) {
      const course = await this.prisma.course.findUnique({
        where: { id: data.courseId, deletedAt: null }
      })

      if (!course) {
        throw CourseNotFoundException
      }
    }

    // Validate subject code is unique if changing code
    if (data.code && data.code !== existingSubject.code) {
      const codeExists = await this.subjectRepo.checkCodeExists(data.code, id)
      if (codeExists) {
        throw SubjectCodeAlreadyExistsException
      }
    }

    // Validate date range if updating dates
    const startDate = data.startDate || existingSubject.startDate
    const endDate = data.endDate || existingSubject.endDate

    if (startDate && endDate) {
      if (new Date(startDate) >= new Date(endDate)) {
        throw InvalidDateRangeException
      }
    }

    return await this.subjectRepo.update({ id, data, updatedById })
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
  }): Promise<SubjectEntityType> {
    // Check if subject exists
    const existingSubject = await this.subjectRepo.findById(id)
    if (!existingSubject) {
      throw SubjectNotFoundException
    }

    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(deletedByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can delete subjects')
    }

    // If user is DEPARTMENT_HEAD, validate they can only delete subjects in courses of their department
    if (deletedByRoleName === RoleName.DEPARTMENT_HEAD) {
      const deleter = await this.prisma.user.findUnique({
        where: { id: deletedById },
        select: { departmentId: true }
      })

      if (
        !deleter?.departmentId ||
        !existingSubject.course?.departmentId ||
        deleter.departmentId !== existingSubject.course.departmentId
      ) {
        throw new ForbiddenException('Department heads can only delete subjects in courses of their own department')
      }
    }

    // Check if subject has enrollments before deletion
    if (isHard) {
      const enrollmentCount = await this.prisma.subjectEnrollment.count({
        where: { subjectId: id }
      })

      if (enrollmentCount > 0) {
        throw new BadRequestException('Cannot permanently delete subject with existing enrollments')
      }

      const instructorCount = await this.prisma.subjectInstructor.count({
        where: { subjectId: id }
      })

      if (instructorCount > 0) {
        throw new BadRequestException('Cannot permanently delete subject with existing instructors')
      }
    }

    return await this.subjectRepo.delete({ id, deletedById, isHard })
  }

  async restore({
    id,
    restoredById,
    restoredByRoleName
  }: {
    id: string
    restoredById: string
    restoredByRoleName: string
  }): Promise<SubjectEntityType> {
    // Check if subject exists (including deleted)
    const existingSubject = await this.subjectRepo.findById(id, { includeDeleted: true })
    if (!existingSubject) {
      throw SubjectNotFoundException
    }

    // Check if subject is actually deleted
    if (!existingSubject.deletedAt) {
      throw new BadRequestException('Subject is not deleted')
    }

    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(restoredByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can restore subjects')
    }

    // If user is DEPARTMENT_HEAD, validate they can only restore subjects in courses of their department
    if (restoredByRoleName === RoleName.DEPARTMENT_HEAD) {
      const restorer = await this.prisma.user.findUnique({
        where: { id: restoredById },
        select: { departmentId: true }
      })

      if (
        !restorer?.departmentId ||
        !existingSubject.course?.departmentId ||
        restorer.departmentId !== existingSubject.course.departmentId
      ) {
        throw new ForbiddenException('Department heads can only restore subjects in courses of their own department')
      }
    }

    // Check if subject code conflicts with existing active subjects
    const codeExists = await this.subjectRepo.checkCodeExists(existingSubject.code, id)
    if (codeExists) {
      throw new BadRequestException('Cannot restore subject: code conflicts with existing active subject')
    }

    return await this.subjectRepo.restore({ id, restoredById })
  }

  async addInstructors({
    subjectId,
    instructors,
    addedByRoleName
  }: {
    subjectId: string
    instructors: AddInstructorsBodyType['instructors']
    addedByRoleName: string
  }): Promise<{ addedInstructors: string[]; duplicateInstructors: string[] }> {
    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(addedByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can manage instructors')
    }

    // Check if subject exists
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    return await this.subjectRepo.addInstructors({ subjectId, instructors })
  }

  async removeInstructors({
    subjectId,
    trainerEids,
    removedByRoleName
  }: {
    subjectId: string
    trainerEids: string[]
    removedByRoleName: string
  }): Promise<{ removedInstructors: string[]; notFoundInstructors: string[] }> {
    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(removedByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can manage instructors')
    }

    // Check if subject exists
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    return await this.subjectRepo.removeInstructors({ subjectId, trainerEids })
  }

  async enrollTrainees({
    subjectId,
    trainees,
    enrolledByRoleName
  }: {
    subjectId: string
    trainees: EnrollTraineesBodyType['trainees']
    enrolledByRoleName: string
  }): Promise<{ enrolledTrainees: string[]; duplicateTrainees: string[] }> {
    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(enrolledByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can manage enrollments')
    }

    // Check if subject exists
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    return await this.subjectRepo.enrollTrainees({ subjectId, trainees })
  }

  async removeEnrollments({
    subjectId,
    traineeEids,
    removedByRoleName
  }: {
    subjectId: string
    traineeEids: string[]
    removedByRoleName: string
  }): Promise<{ removedTrainees: string[]; notFoundTrainees: string[] }> {
    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD].includes(removedByRoleName as any)) {
      throw new ForbiddenException('Only administrators and department heads can manage enrollments')
    }

    // Check if subject exists
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    return await this.subjectRepo.removeEnrollments({ subjectId, traineeEids })
  }

  async updateEnrollmentStatus({
    subjectId,
    traineeEid,
    status,
    updatedByRoleName
  }: {
    subjectId: string
    traineeEid: string
    status: UpdateEnrollmentStatusBodyType['status']
    updatedByRoleName: string
  }): Promise<{ success: boolean }> {
    // Validate permissions
    if (![RoleName.ADMINISTRATOR, RoleName.DEPARTMENT_HEAD, RoleName.TRAINER].includes(updatedByRoleName as any)) {
      throw new ForbiddenException('Only administrators, department heads, and trainers can update enrollment status')
    }

    // Check if subject exists
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      throw SubjectNotFoundException
    }

    const success = await this.subjectRepo.updateEnrollmentStatus({
      subjectId,
      traineeEid,
      status
    })

    if (!success) {
      throw new BadRequestException('Trainee enrollment not found')
    }

    return { success }
  }

  async getStats({ includeDeleted = false }: { includeDeleted?: boolean } = {}): Promise<SubjectStatsType> {
    return await this.subjectRepo.getStats({ includeDeleted })
  }

  async getSubjectsByCourse({
    courseId,
    includeDeleted = false
  }: {
    courseId: string
    includeDeleted?: boolean
  }): Promise<SubjectWithInfoType[]> {
    const result = await this.subjectRepo.list({
      page: 1,
      limit: 1000, // Large limit to get all subjects
      courseId,
      includeDeleted
    })

    return result.subjects
  }

  async validateSubjectAccess({
    subjectId,
    userId,
    userRole
  }: {
    subjectId: string
    userId: string
    userRole: string
  }): Promise<boolean> {
    // Admins have access to all subjects
    if (userRole === RoleName.ADMINISTRATOR) {
      return true
    }

    // Get subject details
    const subject = await this.subjectRepo.findById(subjectId)
    if (!subject) {
      return false
    }

    // Department heads have access to subjects in courses of their department
    if (userRole === RoleName.DEPARTMENT_HEAD) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true }
      })

      return user?.departmentId === subject.course?.departmentId
    }

    // Trainers have access to subjects where they are assigned as instructors
    if (userRole === RoleName.TRAINER) {
      const instructorCount = await this.prisma.subjectInstructor.count({
        where: {
          trainerUserId: userId,
          subjectId
        }
      })

      return instructorCount > 0
    }

    // Trainees have access to subjects where they are enrolled
    if (userRole === RoleName.TRAINEE) {
      const enrollmentCount = await this.prisma.subjectEnrollment.count({
        where: {
          traineeUserId: userId,
          subjectId
        }
      })

      return enrollmentCount > 0
    }

    return false
  }

  async getSubjectInstructors(subjectId: string): Promise<any[]> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        instructors: {
          include: {
            trainer: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    })

    return subject?.instructors || []
  }

  async getSubjectEnrollments(subjectId: string): Promise<any[]> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        enrollments: {
          include: {
            trainee: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    })

    return subject?.enrollments || []
  }
}

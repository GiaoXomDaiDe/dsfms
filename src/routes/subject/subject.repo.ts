import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { RoleName } from '~/shared/constants/auth.constant'
import { SubjectMethodValue, SubjectStatusValue, SubjectTypeValue } from '~/shared/constants/subject.constant'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'
import { TraineeNotFoundException, TraineeResolutionFailureException } from './subject.error'
import {
  CreateSubjectBodyType,
  EnrollTraineesBodyType,
  GetSubjectDetailResType,
  GetSubjectsQueryType,
  GetSubjectsResType,
  GetSubjectsType,
  SubjectDetailCourseType,
  SubjectDetailEnrollmentsByBatchType,
  SubjectDetailInstructorType,
  SubjectDetailTraineeType,
  SubjectEntityType,
  UpdateSubjectBodyType
} from './subject.model'

@Injectable()
@SerializeAll()
export class SubjectRepo {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: GetSubjectsQueryType & { includeDeleted?: boolean }): Promise<GetSubjectsResType> {
    const { method, type, isSIM, courseId, status, includeDeleted } = query

    const where: Prisma.SubjectWhereInput = {
      // Lọc soft delete - chỉ hiện bản ghi chưa xóa trừ khi includeDeleted = true
      ...(includeDeleted ? {} : { deletedAt: null }),

      // Các bộ lọc nghiệp vụ
      ...(courseId && { courseId: courseId }),
      ...(method && { method: method as SubjectMethodValue }),
      ...(isSIM !== undefined && { isSIM: isSIM }),
      ...(type && { type: type as SubjectTypeValue }),

      // Lọc status - nếu user chọn ARCHIVED thì hiện ARCHIVED
      // Nếu không truyền status và includeDeleted = false thì mặc định ẩn ARCHIVED
      ...(status
        ? { status: status as SubjectStatusValue }
        : includeDeleted
          ? {}
          : { status: { not: 'ARCHIVED' as SubjectStatusValue } })
    }

    const [subjects, totalItems] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        include: {
          _count: {
            select: {
              instructors: true,
              enrollments: {
                where: {
                  status: { not: 'CANCELLED' }
                }
              }
            }
          }
        }
      }),
      this.prisma.subject.count({ where })
    ])

    const transformedSubjects = subjects.map((subject) => {
      const { _count, ...subjectWithoutCount } = subject
      return {
        ...subjectWithoutCount,
        instructorCount: _count.instructors,
        enrollmentCount: _count.enrollments
      }
    }) as GetSubjectsType[]

    return {
      subjects: transformedSubjects,
      totalItems
    }
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<GetSubjectDetailResType | null> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null })
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            department: {
              select: {
                id: true,
                name: true,
                code: true,
                isActive: true
              }
            }
          }
        },
        instructors: {
          include: {
            trainer: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                middleName: true,
                lastName: true,
                status: true
              }
            }
          },
          where: includeDeleted
            ? {}
            : {
                trainer: {
                  deletedAt: null,
                  status: 'ACTIVE'
                }
              }
        },
        enrollments: {
          include: {
            trainee: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                middleName: true,
                lastName: true,
                status: true
              }
            }
          },
          where: includeDeleted
            ? {}
            : {
                trainee: {
                  deletedAt: null
                }
              }
        }
      }
    })

    if (!subject) return null

    const transformedInstructors: SubjectDetailInstructorType[] = subject.instructors.map((instructor) => ({
      id: instructor.trainer.id,
      eid: instructor.trainer.eid,
      firstName: instructor.trainer.firstName,
      middleName: instructor.trainer.middleName === null ? '' : instructor.trainer.middleName,
      lastName: instructor.trainer.lastName,
      status: instructor.trainer.status,
      roleInSubject: instructor.roleInSubject,
      assignedAt: instructor.createdAt
    }))

    const enrollmentsByBatch: SubjectDetailEnrollmentsByBatchType[] = subject.enrollments.reduce((acc, enrollment) => {
      const existingBatch = acc.find((batch) => batch.batchCode === enrollment.batchCode)

      const traineeData: SubjectDetailTraineeType = {
        id: enrollment.trainee.id,
        eid: enrollment.trainee.eid,
        firstName: enrollment.trainee.firstName,
        middleName: enrollment.trainee.middleName,
        lastName: enrollment.trainee.lastName,
        status: enrollment.trainee.status,
        enrollmentDate: enrollment.enrollmentDate,
        enrollmentStatus: enrollment.status
      }

      if (existingBatch) {
        existingBatch.trainees.push(traineeData)
      } else {
        acc.push({
          batchCode: enrollment.batchCode,
          trainees: [traineeData]
        })
      }

      return acc
    }, [] as SubjectDetailEnrollmentsByBatchType[])

    const transformedCourse: SubjectDetailCourseType = subject.course
      ? {
          id: subject.course.id,
          name: subject.course.name,
          code: subject.course.code,
          status: subject.course.status,
          department: {
            id: subject.course.department.id,
            name: subject.course.department.name,
            code: subject.course.department.code,
            isActive: subject.course.department.isActive
          }
        }
      : null

    const { courseId, createdById, updatedById, enrollments, ...subjectWithoutRedundant } = subject

    return {
      ...subjectWithoutRedundant,
      course: transformedCourse,
      instructors: transformedInstructors,
      enrollmentsByBatch
    } as GetSubjectDetailResType
  }

  async createSimple({
    data,
    createdById
  }: {
    data: CreateSubjectBodyType & { duration?: number }
    createdById: string
  }): Promise<GetSubjectDetailResType> {
    const subject = await this.prisma.subject.create({
      data: {
        ...data,
        createdById,
        updatedById: createdById
      }
    })

    return subject as unknown as GetSubjectDetailResType
  }

  async create({
    data,
    createdById
  }: {
    data: CreateSubjectBodyType & { duration?: number }
    createdById: string
  }): Promise<GetSubjectDetailResType> {
    const subject = await this.prisma.subject.create({
      data: {
        ...data,
        createdById,
        updatedById: createdById
      },
      include: {
        course: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true
          }
        },
        instructors: {
          include: {
            trainer: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        enrollments: {
          include: {
            trainee: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    })

    return {
      ...subject,
      startDate: subject.startDate?.toISOString() || null,
      endDate: subject.endDate?.toISOString() || null,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
      deletedAt: subject.deletedAt?.toISOString() || null,
      instructors: subject.instructors.map((instructor) => ({
        ...instructor,
        createdAt: instructor.createdAt.toISOString(),
        trainer: instructor.trainer
      })),
      enrollments: subject.enrollments.map((enrollment) => ({
        ...enrollment,
        enrollmentDate: enrollment.enrollmentDate.toISOString(),
        createdAt: enrollment.createdAt.toISOString(),
        updatedAt: enrollment.updatedAt.toISOString(),
        trainee: enrollment.trainee
      })),
      instructorCount: subject.instructors.length,
      enrollmentCount: subject.enrollments.length
    } as unknown as GetSubjectDetailResType
  }

  async updateSimple({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateSubjectBodyType & { duration?: number }
    updatedById: string
  }): Promise<GetSubjectDetailResType> {
    const subject = await this.prisma.subject.update({
      where: { id },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      }
    })

    return subject as unknown as GetSubjectDetailResType
  }

  async update({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateSubjectBodyType & { duration?: number }
    updatedById: string
  }): Promise<GetSubjectDetailResType> {
    const subject = await this.prisma.subject.update({
      where: { id },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      },
      include: {
        course: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true
          }
        },
        instructors: {
          include: {
            trainer: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        enrollments: {
          include: {
            trainee: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    })

    return {
      ...subject,
      startDate: subject.startDate?.toISOString() || null,
      endDate: subject.endDate?.toISOString() || null,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
      deletedAt: subject.deletedAt?.toISOString() || null,
      instructors: subject.instructors.map((instructor) => ({
        ...instructor,
        createdAt: instructor.createdAt.toISOString(),
        trainer: instructor.trainer
      })),
      enrollments: subject.enrollments.map((enrollment) => ({
        ...enrollment,
        enrollmentDate: enrollment.enrollmentDate.toISOString(),
        createdAt: enrollment.createdAt.toISOString(),
        updatedAt: enrollment.updatedAt.toISOString(),
        trainee: enrollment.trainee
      })),
      instructorCount: subject.instructors.length,
      enrollmentCount: subject.enrollments.length
    } as unknown as GetSubjectDetailResType
  }

  async delete({
    id,
    deletedById,
    isHard = false
  }: {
    id: string
    deletedById: string
    isHard?: boolean
  }): Promise<SubjectEntityType> {
    if (isHard) {
      return (await this.prisma.subject.delete({
        where: { id }
      })) as unknown as SubjectEntityType
    }

    return (await this.prisma.subject.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById,
        updatedAt: new Date()
      }
    })) as unknown as SubjectEntityType
  }

  async checkCodeExists(code: string, excludeId?: string): Promise<boolean> {
    const where: any = {
      code,
      deletedAt: null
    }

    if (excludeId) {
      where.id = { not: excludeId }
    }

    const count = await this.prisma.subject.count({ where })
    return count > 0
  }

  async countEnrollments(subjectId: string): Promise<number> {
    return await this.prisma.subjectEnrollment.count({
      where: { subjectId }
    })
  }

  async countInstructors(subjectId: string): Promise<number> {
    return await this.prisma.subjectInstructor.count({
      where: { subjectId }
    })
  }

  async enrollTrainees({
    subjectId,
    trainees
  }: {
    subjectId: string
    trainees: EnrollTraineesBodyType['trainees']
  }): Promise<{ enrolledTrainees: string[]; duplicateTrainees: string[] }> {
    // Get trainee EIDs
    const traineeEids = trainees.map((trainee) => trainee.traineeEid)

    // Validate trainees exist and have TRAINEE role
    const traineeUsers = await this.prisma.user.findMany({
      where: {
        eid: { in: traineeEids },
        role: {
          name: RoleName.TRAINEE
        },
        deletedAt: null
      },
      select: {
        id: true,
        eid: true
      }
    })

    const traineeMap = new Map(traineeUsers.map((trainee) => [trainee.eid, trainee.id]))

    // Check for existing enrollments
    const existingEnrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId,
        traineeUserId: { in: traineeUsers.map((t) => t.id) }
      },
      select: {
        traineeUserId: true,
        trainee: {
          select: { eid: true }
        }
      }
    })

    const existingTraineeIds = new Set(existingEnrollments.map((enr) => enr.traineeUserId))
    const duplicateTrainees = existingEnrollments.map((enr) => enr.trainee.eid)

    // Prepare data for new enrollments
    const newEnrollmentData = []
    const enrolledTrainees: string[] = []

    for (const trainee of trainees) {
      const traineeId = traineeMap.get(trainee.traineeEid)
      if (traineeId && !existingTraineeIds.has(traineeId)) {
        newEnrollmentData.push({
          subjectId,
          traineeUserId: traineeId,
          enrollmentDate: new Date(),
          batchCode: trainee.batchCode
        })
        enrolledTrainees.push(trainee.traineeEid)
      }
    }

    // Create new enrollments
    if (newEnrollmentData.length > 0) {
      await this.prisma.subjectEnrollment.createMany({
        data: newEnrollmentData
      })
    }

    return {
      enrolledTrainees,
      duplicateTrainees
    }
  }

  async removeEnrollments({
    subjectId,
    traineeEids
  }: {
    subjectId: string
    traineeEids: string[]
  }): Promise<{ removedTrainees: string[]; notFoundTrainees: string[] }> {
    // Get trainee IDs from EIDs
    const trainees = await this.prisma.user.findMany({
      where: {
        eid: { in: traineeEids },
        deletedAt: null
      },
      select: {
        id: true,
        eid: true
      }
    })

    const traineeMap = new Map(trainees.map((trainee) => [trainee.eid, trainee.id]))
    const traineeIds = trainees.map((t) => t.id)

    // Find existing enrollments
    const existingEnrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId,
        traineeUserId: { in: traineeIds }
      },
      select: {
        traineeUserId: true,
        trainee: {
          select: { eid: true }
        }
      }
    })

    const existingTraineeIds = existingEnrollments.map((enr) => enr.traineeUserId)
    const removedTrainees = existingEnrollments.map((enr) => enr.trainee.eid)

    // Find not found trainees
    const notFoundTrainees = traineeEids.filter(
      (eid) => !traineeMap.has(eid) || !existingTraineeIds.includes(traineeMap.get(eid)!)
    )

    // Remove enrollments
    if (existingTraineeIds.length > 0) {
      await this.prisma.subjectEnrollment.deleteMany({
        where: {
          subjectId,
          traineeUserId: { in: existingTraineeIds }
        }
      })
    }

    return {
      removedTrainees,
      notFoundTrainees
    }
  }

  // ========================================
  // TRAINER ASSIGNMENT METHODS
  // ========================================

  /**
   * Get available trainers in a department who are not assigned to any subject in a course
   */
  async getAvailableTrainersInDepartment({
    departmentId,
    courseId
  }: {
    departmentId: string
    courseId: string
  }): Promise<any[]> {
    // Get all subject IDs in the course
    const subjectIds = await this.prisma.subject.findMany({
      where: {
        courseId,
        deletedAt: null
      },
      select: { id: true }
    })

    const subjectIdsList = subjectIds.map((s) => s.id)

    // Get trainers already assigned to subjects in this course
    const assignedTrainerIds = await this.prisma.subjectInstructor.findMany({
      where: {
        subjectId: { in: subjectIdsList }
      },
      select: { trainerUserId: true },
      distinct: ['trainerUserId']
    })

    const assignedIds = assignedTrainerIds.map((t) => t.trainerUserId)

    // Get available trainers from department
    const availableTrainers = await this.prisma.user.findMany({
      where: {
        departmentId,
        deletedAt: null,
        role: {
          name: RoleName.TRAINER
        },
        id: { notIn: assignedIds }
      },
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        email: true,
        departmentId: true
      }
    })

    return availableTrainers
  }

  /**
   * Assign a trainer to a subject
   */
  async assignTrainerToSubject({
    subjectId,
    trainerUserId,
    roleInSubject
  }: {
    subjectId: string
    trainerUserId: string
    roleInSubject: any
  }): Promise<any> {
    return await this.prisma.subjectInstructor.create({
      data: {
        subjectId,
        trainerUserId,
        roleInSubject
      }
    })
  }

  /**
   * Update trainer assignment (change trainer, subject, or role)
   */
  async updateTrainerAssignment({
    currentSubjectId,
    currentTrainerUserId,
    newSubjectId,
    newTrainerUserId,
    newRoleInSubject
  }: {
    currentSubjectId: string
    currentTrainerUserId: string
    newSubjectId?: string
    newTrainerUserId?: string
    newRoleInSubject?: any
  }): Promise<any> {
    // Delete current assignment
    await this.prisma.subjectInstructor.delete({
      where: {
        trainerUserId_subjectId: {
          trainerUserId: currentTrainerUserId,
          subjectId: currentSubjectId
        }
      }
    })

    // Create new assignment
    return await this.prisma.subjectInstructor.create({
      data: {
        subjectId: newSubjectId || currentSubjectId,
        trainerUserId: newTrainerUserId || currentTrainerUserId,
        roleInSubject: newRoleInSubject
      }
    })
  }

  /**
   * Remove trainer from subject
   */
  async removeTrainerFromSubject({
    subjectId,
    trainerUserId
  }: {
    subjectId: string
    trainerUserId: string
  }): Promise<void> {
    await this.prisma.subjectInstructor.delete({
      where: {
        trainerUserId_subjectId: {
          trainerUserId,
          subjectId
        }
      }
    })
  }

  /**
   * Check if trainer is assigned to subject
   */
  async isTrainerAssignedToSubject({
    subjectId,
    trainerUserId
  }: {
    subjectId: string
    trainerUserId: string
  }): Promise<boolean> {
    const assignment = await this.prisma.subjectInstructor.findUnique({
      where: {
        trainerUserId_subjectId: {
          trainerUserId,
          subjectId
        }
      }
    })
    return !!assignment
  }

  // ========================================
  // TRAINEE ASSIGNMENT METHODS
  // ========================================

  /**
   * Lookup trainees by EID or email
   */
  async lookupTrainees({
    trainees
  }: {
    trainees: Array<{ eid?: string; email?: string }>
  }): Promise<{ foundUsers: any[]; notFoundIdentifiers: any[] }> {
    const foundUsers: any[] = []
    const notFoundIdentifiers: any[] = []

    for (const trainee of trainees) {
      const where: any = {
        deletedAt: null,
        role: {
          name: RoleName.TRAINEE
        }
      }

      if (trainee.eid) {
        where.eid = trainee.eid
      } else if (trainee.email) {
        where.email = trainee.email
      }

      const found = await this.prisma.user.findFirst({
        where,
        include: {
          role: {
            select: {
              id: true,
              name: true
            }
          },
          department: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      if (found) {
        // Transform to match user list format
        const { passwordHash, signatureImageUrl, roleId, departmentId, ...userWithoutSensitive } = found
        foundUsers.push({
          ...userWithoutSensitive,
          role: found.role,
          department: found.department
        })
      } else {
        notFoundIdentifiers.push(trainee)
      }
    }

    return { foundUsers, notFoundIdentifiers }
  }

  /**
   * Assign trainees to subject with validations
   */
  async assignTraineesToSubject({
    subjectId,
    traineeUserIds,
    batchCode
  }: {
    subjectId: string
    traineeUserIds: string[]
    batchCode: string
  }): Promise<{
    enrolled: Array<{
      userId: string
      eid: string
      fullName: string
      email: string
      department: { id: string; name: string } | null
    }>
    duplicates: Array<{
      userId: string
      eid: string
      fullName: string
      email: string
      department: { id: string; name: string } | null
      enrolledAt: string
      batchCode: string
    }>
    invalid: Array<{
      submittedId: string
      eid?: string
      email?: string
      reason: 'USER_NOT_FOUND' | 'ROLE_NOT_TRAINEE' | 'USER_INACTIVE'
      note?: string
    }>
  }> {
    const requestedUsers = await this.prisma.user.findMany({
      where: {
        id: { in: traineeUserIds }
      },
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        email: true,
        deletedAt: true,
        role: {
          select: { name: true }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    const requestedUserMap = new Map(requestedUsers.map((user) => [user.id, user]))

    const invalidMap = new Map<
      string,
      {
        submittedId: string
        eid?: string
        email?: string
        reason: 'USER_NOT_FOUND' | 'ROLE_NOT_TRAINEE' | 'USER_INACTIVE'
        note?: string
      }
    >()

    const missingIds = traineeUserIds.filter((id) => !requestedUserMap.has(id))
    missingIds.forEach((id) => {
      invalidMap.set(id, {
        submittedId: id,
        reason: 'USER_NOT_FOUND'
      })
    })

    requestedUsers.forEach((user) => {
      if (user.deletedAt) {
        invalidMap.set(user.id, {
          submittedId: user.id,
          eid: user.eid,
          email: user.email,
          reason: 'USER_INACTIVE',
          note: 'User is inactive or deleted'
        })
        return
      }

      if (user.role?.name !== RoleName.TRAINEE) {
        invalidMap.set(user.id, {
          submittedId: user.id,
          eid: user.eid,
          email: user.email,
          reason: 'ROLE_NOT_TRAINEE',
          note: `Expected role TRAINEE but received ${user.role?.name ?? 'UNKNOWN'}`
        })
      }
    })

    const eligibleUserIds = traineeUserIds.filter((id) => !invalidMap.has(id))

    const existingEnrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId,
        traineeUserId: { in: eligibleUserIds }
      },
      select: {
        traineeUserId: true,
        batchCode: true,
        enrollmentDate: true,
        trainee: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true,
            email: true,
            department: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    const existingIds = new Set(existingEnrollments.map((enrollment) => enrollment.traineeUserId))

    const newIds = eligibleUserIds.filter((id) => !existingIds.has(id))
    const newEnrollments = newIds.map((id) => ({
      subjectId,
      traineeUserId: id,
      enrollmentDate: new Date(),
      batchCode,
      status: 'ENROLLED' as any
    }))

    if (newEnrollments.length > 0) {
      await this.prisma.subjectEnrollment.createMany({
        data: newEnrollments
      })
    }

    type AssignmentUserRecord = {
      id: string
      eid: string
      firstName: string | null
      lastName: string | null
      email: string
      department: { id: string; name: string } | null
    }

    const resolveUserPayload = (user: AssignmentUserRecord) => {
      const nameParts = [user.firstName ?? '', user.lastName ?? ''].filter((part) => part.trim().length > 0)
      const fullName = nameParts.join(' ').trim()

      return {
        userId: user.id,
        eid: user.eid,
        fullName: fullName.length > 0 ? fullName : user.eid,
        email: user.email,
        department: user.department ? { id: user.department.id, name: user.department.name } : null
      }
    }

    const enrolled = newIds.map((id) => {
      const user = requestedUserMap.get(id) as AssignmentUserRecord | undefined
      if (!user) {
        throw TraineeResolutionFailureException(id)
      }
      return resolveUserPayload(user)
    })

    const duplicates = existingEnrollments.map((enrollment) => {
      const fallbackUser = enrollment.trainee as AssignmentUserRecord
      const user = (requestedUserMap.get(enrollment.traineeUserId) as AssignmentUserRecord | undefined) ?? fallbackUser

      const payload = resolveUserPayload(user)

      return {
        ...payload,
        enrolledAt: enrollment.enrollmentDate ? enrollment.enrollmentDate.toISOString() : new Date().toISOString(),
        batchCode: enrollment.batchCode
      }
    })

    const invalid = Array.from(invalidMap.values())

    return {
      enrolled,
      duplicates,
      invalid
    }
  }

  /**
   * Cancel all course enrollments for a trainee in a specific batch
   */

  /**
   * Get trainee enrollments across all subjects
   */
  async getTraineeEnrollments({
    traineeUserId,
    batchCode,
    status
  }: {
    traineeUserId: string
    batchCode?: string
    status?: any
  }): Promise<{
    trainee: {
      userId: string
      eid: string
      fullName: string
      email: string
      department: { id: string; name: string } | null
    }
    enrollments: Array<{
      subject: {
        id: string
        code: string
        name: string
        status: string
        type: string
        method: string
        startDate: string | null
        endDate: string | null
        course: { id: string; name: string } | null
      }
      enrollment: {
        batchCode: string
        status: string
        enrollmentDate: string
        updatedAt: string
      }
    }>
  }> {
    const trainee = await this.prisma.user.findUnique({
      where: { id: traineeUserId },
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        email: true,
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!trainee) {
      throw TraineeNotFoundException
    }

    const where: any = {
      traineeUserId
    }

    if (batchCode) {
      where.batchCode = batchCode
    }

    if (status) {
      where.status = status
    }

    const enrollments = await this.prisma.subjectEnrollment.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            type: true,
            method: true,
            startDate: true,
            endDate: true,
            course: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    const nameParts = [trainee.firstName ?? '', trainee.lastName ?? ''].filter((part) => part.trim().length > 0)
    const traineeInfo = {
      userId: trainee.id,
      eid: trainee.eid,
      fullName: nameParts.length > 0 ? nameParts.join(' ') : trainee.eid,
      email: trainee.email,
      department: trainee.department ? { id: trainee.department.id, name: trainee.department.name } : null
    }

    const enrollmentDetails = enrollments.map((e) => ({
      subject: {
        id: e.subject.id,
        code: e.subject.code,
        name: e.subject.name,
        status: e.subject.status,
        type: e.subject.type,
        method: e.subject.method,
        startDate: e.subject.startDate ? e.subject.startDate.toISOString() : null,
        endDate: e.subject.endDate ? e.subject.endDate.toISOString() : null,
        course: e.subject.course ? { id: e.subject.course.id, name: e.subject.course.name } : null
      },
      enrollment: {
        batchCode: e.batchCode,
        status: e.status,
        enrollmentDate: e.enrollmentDate.toISOString(),
        updatedAt: e.updatedAt.toISOString()
      }
    }))

    return {
      trainee: traineeInfo,
      enrollments: enrollmentDetails
    }
  }

  /**
   * Cancel specific subject enrollment for a trainee
   */
  async cancelSubjectEnrollment({
    subjectId,
    traineeUserId,
    batchCode
  }: {
    subjectId: string
    traineeUserId: string
    batchCode: string
  }): Promise<boolean> {
    // Check if enrollment exists and is ENROLLED
    const enrollment = await this.prisma.subjectEnrollment.findUnique({
      where: {
        traineeUserId_subjectId: {
          traineeUserId,
          subjectId
        }
      }
    })

    if (!enrollment || enrollment.batchCode !== batchCode || enrollment.status !== 'ENROLLED') {
      return false
    }

    // Update to CANCELLED
    await this.prisma.subjectEnrollment.update({
      where: {
        traineeUserId_subjectId: {
          traineeUserId,
          subjectId
        }
      },
      data: {
        status: 'CANCELLED'
      }
    })

    return true
  }

  /**
   * Get course max trainees and current count
   */
  async getCourseTraineeCount(courseId: string): Promise<{ current: number; max: number | null }> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { maxNumTrainee: true }
    })

    // Get all subject IDs
    const subjectIds = await this.prisma.subject.findMany({
      where: { courseId, deletedAt: null },
      select: { id: true }
    })

    const subjectIdsList = subjectIds.map((s) => s.id)

    // Count distinct trainees
    const distinctTrainees = await this.prisma.subjectEnrollment.findMany({
      where: {
        subjectId: { in: subjectIdsList }
      },
      select: {
        traineeUserId: true
      },
      distinct: ['traineeUserId']
    })

    return {
      current: distinctTrainees.length,
      max: course?.maxNumTrainee || null
    }
  }

  /**
   * Check if trainee can enroll in recurrent subject
   */
  async canEnrollInRecurrentSubject({
    traineeUserId,
    subjectId
  }: {
    traineeUserId: string
    subjectId: string
  }): Promise<{ canEnroll: boolean; reason?: string }> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: {
        type: true,
        startDate: true,
        endDate: true
      }
    })

    if (!subject || subject.type !== 'RECURRENT') {
      return { canEnroll: true }
    }

    if (!subject.startDate || !subject.endDate) {
      return { canEnroll: true }
    }

    // Check if trainee has previous enrollment
    const previousEnrollment = await this.prisma.subjectEnrollment.findUnique({
      where: {
        traineeUserId_subjectId: {
          traineeUserId,
          subjectId
        }
      }
    })

    if (!previousEnrollment) {
      return { canEnroll: true }
    }

    // Check if current time is after end date
    const now = new Date()
    const endDate = new Date(subject.endDate)

    if (now < endDate) {
      return {
        canEnroll: false,
        reason: `Cannot re-enroll in recurrent subject until after ${endDate.toISOString()}`
      }
    }

    return { canEnroll: true }
  }
}

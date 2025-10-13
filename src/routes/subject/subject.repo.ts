import { Injectable } from '@nestjs/common'
import { RoleName } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'
import { TraineeNotFoundException, TraineeResolutionFailureException } from './subject.error'
import {
  CreateSubjectBodyType,
  EnrollTraineesBodyType,
  GetSubjectsQueryType,
  GetSubjectsResType,
  SubjectDetailResType,
  SubjectEntityType,
  SubjectResType,
  SubjectWithInfoType,
  UpdateSubjectBodyType
} from './subject.model'

@Injectable()
export class SubjectRepo {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: GetSubjectsQueryType): Promise<GetSubjectsResType> {
    const { page = 1, limit = 10, search, method, type, isSIM, courseId, includeDeleted = false } = query

    const skip = (page - 1) * limit

    // Build where condition
    const where: any = {
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...(search && {
        OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }]
      }),
      ...(method && { method }),
      ...(type && { type }),
      ...(isSIM !== undefined && { isSIM }),
      ...(courseId && { courseId })
    }

    // Get subjects with relations (exclude createdBy/updatedBy)
    const subjects = await this.prisma.subject.findMany({
      where,
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
        _count: {
          select: {
            instructors: true,
            enrollments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })

    // Get total count
    const totalItems = await this.prisma.subject.count({ where })

    // Transform data
    const transformedSubjects = subjects.map((subject) => {
      const { _count, ...subjectWithoutCount } = subject
      return {
        ...subjectWithoutCount,
        startDate: subject.startDate?.toISOString() || null,
        endDate: subject.endDate?.toISOString() || null,
        createdAt: subject.createdAt.toISOString(),
        updatedAt: subject.updatedAt.toISOString(),
        deletedAt: subject.deletedAt?.toISOString() || null,
        instructors: [],
        enrollments: [],
        instructorCount: _count.instructors,
        enrollmentCount: _count.enrollments
      }
    }) as unknown as SubjectWithInfoType[]

    const totalPages = Math.ceil(totalItems / limit)

    return {
      subjects: transformedSubjects,
      totalItems,
      totalPages,
      currentPage: page
    }
  }

  async findById(
    id: string,
    { includeDeleted = false }: { includeDeleted?: boolean } = {}
  ): Promise<SubjectDetailResType | null> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null })
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

    if (!subject) return null

    // Transform instructors - flatten structure
    const transformedInstructors = subject.instructors.map((instructor) => ({
      id: instructor.trainer.id,
      eid: instructor.trainer.eid,
      firstName: instructor.trainer.firstName,
      lastName: instructor.trainer.lastName,
      roleInSubject: instructor.roleInSubject,
      assignedAt: instructor.createdAt.toISOString()
    }))

    // Transform enrollments - flatten structure
    const transformedEnrollments = subject.enrollments.map((enrollment) => ({
      id: enrollment.trainee.id,
      eid: enrollment.trainee.eid,
      firstName: enrollment.trainee.firstName,
      lastName: enrollment.trainee.lastName,
      enrollmentDate: enrollment.enrollmentDate.toISOString(),
      batchCode: enrollment.batchCode,
      status: enrollment.status
    }))

    return {
      ...subject,
      startDate: subject.startDate?.toISOString() || null,
      endDate: subject.endDate?.toISOString() || null,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
      deletedAt: subject.deletedAt?.toISOString() || null,
      instructors: transformedInstructors,
      enrollments: transformedEnrollments,
      instructorCount: subject.instructors.length,
      enrollmentCount: subject.enrollments.length
    } as unknown as SubjectDetailResType
  }

  async createSimple({
    data,
    createdById
  }: {
    data: CreateSubjectBodyType
    createdById: string
  }): Promise<SubjectResType> {
    const subject = await this.prisma.subject.create({
      data: {
        ...data,
        createdById,
        updatedById: createdById
      }
    })

    return {
      ...subject,
      startDate: subject.startDate?.toISOString() || null,
      endDate: subject.endDate?.toISOString() || null,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
      deletedAt: subject.deletedAt?.toISOString() || null
    } as SubjectResType
  }

  async create({
    data,
    createdById
  }: {
    data: CreateSubjectBodyType
    createdById: string
  }): Promise<SubjectDetailResType> {
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
    } as unknown as SubjectDetailResType
  }

  async updateSimple({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateSubjectBodyType
    updatedById: string
  }): Promise<SubjectResType> {
    const subject = await this.prisma.subject.update({
      where: { id },
      data: {
        ...data,
        updatedById,
        updatedAt: new Date()
      }
    })

    return {
      ...subject,
      startDate: subject.startDate?.toISOString() || null,
      endDate: subject.endDate?.toISOString() || null,
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
      deletedAt: subject.deletedAt?.toISOString() || null
    } as SubjectResType
  }

  async update({
    id,
    data,
    updatedById
  }: {
    id: string
    data: UpdateSubjectBodyType
    updatedById: string
  }): Promise<SubjectDetailResType> {
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
    } as unknown as SubjectDetailResType
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

  async restore({ id, restoredById }: { id: string; restoredById: string }): Promise<SubjectEntityType> {
    return (await this.prisma.subject.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedById: null,
        updatedById: restoredById,
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
   * Get course trainees (distinct trainees enrolled in any subject of the course)
   */
  async getCourseTrainees({
    courseId,
    page,
    limit,
    batchCode
  }: {
    courseId: string
    page: number
    limit: number
    batchCode?: string
  }): Promise<{ trainees: any[]; totalItems: number; totalPages: number }> {
    // Get all subject IDs in course
    const subjectIds = await this.prisma.subject.findMany({
      where: { courseId, deletedAt: null },
      select: { id: true }
    })

    const subjectIdsList = subjectIds.map((s) => s.id)

    const where: any = {
      subjectId: { in: subjectIdsList }
    }

    if (batchCode) {
      where.batchCode = batchCode
    }

    // Get distinct trainee IDs
    const enrollments = await this.prisma.subjectEnrollment.findMany({
      where,
      select: {
        traineeUserId: true,
        batchCode: true,
        trainee: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      distinct: ['traineeUserId']
    })

    // Group by trainee and count enrollments
    const traineeMap = new Map<string, any>()

    for (const enr of enrollments) {
      if (!traineeMap.has(enr.traineeUserId)) {
        traineeMap.set(enr.traineeUserId, {
          ...enr.trainee,
          enrollmentCount: 0,
          batches: new Set<string>()
        })
      }

      const trainee = traineeMap.get(enr.traineeUserId)
      trainee.enrollmentCount++
      trainee.batches.add(enr.batchCode)
    }

    const trainees = Array.from(traineeMap.values()).map((t) => ({
      ...t,
      batches: Array.from(t.batches)
    }))

    const totalItems = trainees.length
    const totalPages = Math.ceil(totalItems / limit)
    const skip = (page - 1) * limit

    return {
      trainees: trainees.slice(skip, skip + limit),
      totalItems,
      totalPages
    }
  }

  /**
   * Cancel all course enrollments for a trainee in a specific batch
   */
  async cancelCourseEnrollments({
    courseId,
    traineeUserId,
    batchCode
  }: {
    courseId: string
    traineeUserId: string
    batchCode: string
  }): Promise<{ cancelledCount: number; notCancelledCount: number }> {
    // Get all subject IDs in course
    const subjectIds = await this.prisma.subject.findMany({
      where: { courseId, deletedAt: null },
      select: { id: true }
    })

    const subjectIdsList = subjectIds.map((s) => s.id)

    // Get enrollments that can be cancelled (only ENROLLED status)
    const enrollments = await this.prisma.subjectEnrollment.findMany({
      where: {
        traineeUserId,
        subjectId: { in: subjectIdsList },
        batchCode,
        status: 'ENROLLED'
      }
    })

    const cancelledCount = enrollments.length

    // Update to CANCELLED
    if (cancelledCount > 0) {
      await this.prisma.subjectEnrollment.updateMany({
        where: {
          traineeUserId,
          subjectId: { in: subjectIdsList },
          batchCode,
          status: 'ENROLLED'
        },
        data: {
          status: 'CANCELLED'
        }
      })
    }

    // Count enrollments that cannot be cancelled
    const notCancelledCount = await this.prisma.subjectEnrollment.count({
      where: {
        traineeUserId,
        subjectId: { in: subjectIdsList },
        batchCode,
        status: { not: 'ENROLLED' }
      }
    })

    return { cancelledCount, notCancelledCount }
  }

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

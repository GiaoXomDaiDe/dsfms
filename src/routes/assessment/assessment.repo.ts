import { Injectable } from '@nestjs/common'
import { AssessmentSectionStatus, AssessmentStatus, Prisma } from '@prisma/client'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'
import {
  AssessmentFormResType,
  CreateAssessmentBodyType,
  GetAssessmentDetailResType,
  GetAssessmentsQueryType,
  GetAssessmentsResType
} from './assessment.model'

@Injectable()
@SerializeAll()
export class AssessmentRepo {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get prisma client for direct queries when needed
   */
  get prismaClient() {
    return this.prisma
  }

  /**
   * Get all enrolled trainees for a specific subject
   */
  async getEnrolledTraineesForSubject(subjectId: string): Promise<
    Array<{
      id: string
      eid: string
      firstName: string
      lastName: string
      middleName: string | null
      email: string
      enrollmentStatus: string
    }>
  > {
    const enrolledTrainees = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: {
          name: 'TRAINEE',
          isActive: true
        },
        subjectEnrollments: {
          some: {
            subjectId,
            status: 'ENROLLED'
          }
        }
      },
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        middleName: true,
        email: true,
        subjectEnrollments: {
          where: {
            subjectId,
            status: 'ENROLLED'
          },
          select: {
            status: true
          }
        }
      }
    })

    return enrolledTrainees.map((trainee) => ({
      id: trainee.id,
      eid: trainee.eid,
      firstName: trainee.firstName,
      lastName: trainee.lastName,
      middleName: trainee.middleName,
      email: trainee.email,
      enrollmentStatus: trainee.subjectEnrollments[0]?.status || 'NOT_ENROLLED'
    }))
  }

  /**
   * Get all enrolled trainees for all subjects in a specific course
   */
  async getEnrolledTraineesForCourse(courseId: string): Promise<
    Array<{
      id: string
      eid: string
      firstName: string
      lastName: string
      middleName: string | null
      email: string
      enrollmentStatus: string
    }>
  > {
    const enrolledTrainees = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: {
          name: 'TRAINEE',
          isActive: true
        },
        subjectEnrollments: {
          some: {
            subject: {
              courseId
            },
            status: 'ENROLLED'
          }
        }
      },
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        middleName: true,
        email: true,
        subjectEnrollments: {
          where: {
            subject: {
              courseId
            },
            status: 'ENROLLED'
          },
          select: {
            status: true
          },
          take: 1
        }
      },
      distinct: ['id'] // Ensure unique trainees even if enrolled in multiple subjects
    })

    return enrolledTrainees.map((trainee) => ({
      id: trainee.id,
      eid: trainee.eid,
      firstName: trainee.firstName,
      lastName: trainee.lastName,
      middleName: trainee.middleName,
      email: trainee.email,
      enrollmentStatus: trainee.subjectEnrollments[0]?.status || 'NOT_ENROLLED'
    }))
  }

  /**
   * Create multiple assessment forms with their sections and values in a transaction
   */
  async createAssessments(
    assessmentData: CreateAssessmentBodyType,
    templateSections: Array<{
      id: string
      fields: Array<{ id: string }>
    }>,
    createdById: string
  ): Promise<AssessmentFormResType[]> {
    return await this.prisma.$transaction(async (tx) => {
      const createdAssessments: AssessmentFormResType[] = []

      // If creating for subject, get the courseId from that subject
      let courseId = assessmentData.courseId
      if (assessmentData.subjectId && !courseId) {
        const subject = await tx.subject.findUnique({
          where: { id: assessmentData.subjectId },
          select: { courseId: true }
        })
        if (subject) {
          courseId = subject.courseId
        }
      }

      for (const traineeId of assessmentData.traineeIds) {
        // Create the main assessment form
        const assessmentForm = await tx.assessmentForm.create({
          data: {
            templateId: assessmentData.templateId,
            name: assessmentData.name,
            subjectId: assessmentData.subjectId || null,
            courseId: courseId || null,
            occuranceDate: assessmentData.occuranceDate,
            createdById,
            updatedById: createdById,
            traineeId,
            status: AssessmentStatus.NOT_STARTED,
            isTraineeLocked: true,
            // All nullable fields remain null by default
            submittedAt: null,
            comment: null,
            approvedById: null,
            approvedAt: null,
            resultScore: null,
            resultText: null,
            pdfUrl: null
          },
          include: {
            template: {
              select: {
                id: true,
                name: true,
                version: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                    code: true
                  }
                }
              }
            },
            trainee: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                lastName: true,
                middleName: true,
                email: true
              }
            },
            subject: {
              select: {
                id: true,
                name: true,
                code: true,
                course: {
                  select: {
                    id: true,
                    name: true,
                    code: true
                  }
                }
              }
            },
            course: {
              select: {
                id: true,
                name: true,
                code: true,
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
                firstName: true,
                lastName: true,
                middleName: true,
                email: true
              }
            },
            approvedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                middleName: true,
                email: true
              }
            }
          }
        })

        // Create assessment sections for each template section
        for (const templateSection of templateSections) {
          const assessmentSection = await tx.assessmentSection.create({
            data: {
              assessmentFormId: assessmentForm.id,
              templateSectionId: templateSection.id,
              status: AssessmentSectionStatus.REQUIRED_ASSESSMENT,
              assessedById: null // Will be set when someone starts filling the section
            }
          })

          // Create assessment values for each field in the section
          for (const field of templateSection.fields) {
            await tx.assessmentValue.create({
              data: {
                assessmentSectionId: assessmentSection.id,
                templateFieldId: field.id,
                answerValue: null, // Empty initially
                createdById
              }
            })
          }
        }

        createdAssessments.push(assessmentForm as AssessmentFormResType)
      }

      return createdAssessments
    })
  }

  /**
   * Check if assessments already exist for the given trainees on the specified date
   */
  async checkDuplicateAssessments(
    traineeIds: string[],
    templateId: string,
    occuranceDate: Date,
    subjectId?: string,
    courseId?: string
  ): Promise<Array<{ traineeId: string; traineeName: string }>> {
    const whereClause: Prisma.AssessmentFormWhereInput = {
      traineeId: { in: traineeIds },
      templateId,
      occuranceDate
    }

    if (subjectId) {
      whereClause.subjectId = subjectId
    }
    if (courseId) {
      whereClause.courseId = courseId
    }

    const existingAssessments = await this.prisma.assessmentForm.findMany({
      where: whereClause,
      select: {
        traineeId: true,
        trainee: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true
          }
        }
      }
    })

    return existingAssessments.map((assessment) => ({
      traineeId: assessment.traineeId,
      traineeName:
        `${assessment.trainee.firstName} ${assessment.trainee.middleName || ''} ${assessment.trainee.lastName}`.trim()
    }))
  }

  /**
   * Check if any assessment form already exists for trainee with the same template and occurrence date
   */
  async checkTraineeAssessmentExists(
    traineeIds: string[],
    templateId: string,
    occuranceDate: Date
  ): Promise<Array<{ traineeId: string; traineeName: string; assessmentId: string }>> {
    const whereClause: Prisma.AssessmentFormWhereInput = {
      traineeId: { in: traineeIds },
      templateId,
      occuranceDate
    }

    const existingAssessments = await this.prisma.assessmentForm.findMany({
      where: whereClause,
      select: {
        id: true,
        traineeId: true,
        trainee: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true
          }
        }
      }
    })

    return existingAssessments.map((assessment) => ({
      traineeId: assessment.traineeId,
      traineeName:
        `${assessment.trainee.firstName} ${assessment.trainee.middleName || ''} ${assessment.trainee.lastName}`.trim(),
      assessmentId: assessment.id
    }))
  }

  /**
   * Get template with its sections and fields
   */
  async getTemplateWithStructure(templateId: string) {
    return await this.prisma.templateForm.findUnique({
      where: {
        id: templateId
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        sections: {
          orderBy: {
            displayOrder: 'asc'
          },
          include: {
            fields: {
              orderBy: {
                displayOrder: 'asc'
              },
              select: {
                id: true,
                label: true,
                fieldName: true,
                fieldType: true,
                displayOrder: true
              }
            }
          }
        }
      }
    })
  }

  /**
   * Validate subject exists and get its details with course and date range
   */
  async getSubjectWithDetails(subjectId: string) {
    return await this.prisma.subject.findUnique({
      where: {
        id: subjectId
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            startDate: true,
            endDate: true,
            status: true,
            department: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        }
      }
    })
  }

  /**
   * Validate course exists and get its details with date range
   */
  async getCourseWithDetails(courseId: string) {
    return await this.prisma.course.findUnique({
      where: {
        id: courseId
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    })
  }

  /**
   * Validate trainees exist and have correct roles and enrollment
   */
  async validateTrainees(traineeIds: string[], subjectId?: string, courseId?: string) {
    const whereClause: Prisma.UserWhereInput = {
      id: { in: traineeIds },
      status: 'ACTIVE',
      role: {
        name: 'TRAINEE',
        isActive: true
      }
    }

    // Add enrollment checks
    if (subjectId) {
      whereClause.subjectEnrollments = {
        some: {
          subjectId,
          status: 'ENROLLED'
        }
      }
    }

    if (courseId) {
      whereClause.subjectEnrollments = {
        some: {
          subject: {
            courseId
          },
          status: 'ENROLLED'
        }
      }
    }

    const validTrainees = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        eid: true,
        firstName: true,
        lastName: true,
        middleName: true,
        email: true,
        role: {
          select: {
            name: true
          }
        }
      }
    })

    return validTrainees
  }

  /**
   * List assessments with pagination and filters
   */
  async list(query: GetAssessmentsQueryType): Promise<GetAssessmentsResType> {
    const { page, limit, status, templateId, subjectId, courseId, traineeId, fromDate, toDate, includeDeleted } = query

    const whereClause: Prisma.AssessmentFormWhereInput = {}

    // Apply filters
    if (status) whereClause.status = status
    if (templateId) whereClause.templateId = templateId
    if (subjectId) whereClause.subjectId = subjectId
    if (courseId) whereClause.courseId = courseId
    if (traineeId) whereClause.traineeId = traineeId

    if (fromDate || toDate) {
      whereClause.occuranceDate = {}
      if (fromDate) whereClause.occuranceDate.gte = fromDate
      if (toDate) whereClause.occuranceDate.lte = toDate
    }

    const skip = (page - 1) * limit

    const [totalItems, assessments] = await Promise.all([
      this.prisma.assessmentForm.count({ where: whereClause }),
      this.prisma.assessmentForm.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ occuranceDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          template: {
            select: {
              id: true,
              name: true,
              version: true,
              department: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          },
          trainee: {
            select: {
              id: true,
              eid: true,
              firstName: true,
              lastName: true,
              middleName: true,
              email: true
            }
          },
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
              course: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          },
          course: {
            select: {
              id: true,
              name: true,
              code: true,
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
              firstName: true,
              lastName: true,
              middleName: true,
              email: true
            }
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              email: true
            }
          }
        }
      })
    ])

    const totalPages = Math.ceil(totalItems / limit)

    return {
      assessments: assessments as AssessmentFormResType[],
      totalItems,
      page,
      limit,
      totalPages
    }
  }

  /**
   * Get single assessment by ID with full details
   */
  async findById(assessmentId: string, includeDeleted = false): Promise<GetAssessmentDetailResType | null> {
    const whereClause: Prisma.AssessmentFormWhereInput = {
      id: assessmentId
    }

    const assessment = await this.prisma.assessmentForm.findFirst({
      where: whereClause,
      include: {
        template: {
          select: {
            id: true,
            name: true,
            version: true,
            department: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        trainee: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true,
            middleName: true,
            email: true
          }
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            course: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
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
            firstName: true,
            lastName: true,
            middleName: true,
            email: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            email: true
          }
        },
        sections: {
          orderBy: {
            templateSection: {
              displayOrder: 'asc'
            }
          },
          include: {
            templateSection: {
              select: {
                id: true,
                label: true,
                displayOrder: true,
                editBy: true,
                roleInSubject: true,
                isSubmittable: true,
                isToggleDependent: true
              }
            },
            assessedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                middleName: true,
                email: true
              }
            },
            values: {
              orderBy: {
                templateField: {
                  displayOrder: 'asc'
                }
              },
              include: {
                templateField: {
                  select: {
                    id: true,
                    label: true,
                    fieldName: true,
                    fieldType: true,
                    roleRequired: true,
                    options: true,
                    displayOrder: true
                  }
                },
                createdBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    middleName: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    })

    return assessment as GetAssessmentDetailResType
  }

  /**
   * Check if user has permission to access the assessment
   * Used for authorization checks
   */
  async checkAssessmentAccess(assessmentId: string, userId: string, userRole: string): Promise<boolean> {
    if (userRole === 'ADMINISTRATOR' || userRole === 'ACADEMIC_DEPARTMENT') {
      return true
    }

    const assessment = await this.prisma.assessmentForm.findUnique({
      where: { id: assessmentId },
      select: {
        traineeId: true,
        createdById: true,
        subjectId: true,
        courseId: true,
        template: {
          select: {
            department: {
              select: {
                id: true
              }
            }
          }
        },
        subject: {
          select: {
            examiners: {
              select: {
                trainerUserId: true
              }
            }
          }
        },
        course: {
          select: {
            subjects: {
              select: {
                examiners: {
                  select: {
                    trainerUserId: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!assessment) return false

    // Trainee can access their own assessments
    if (userRole === 'TRAINEE' && assessment.traineeId === userId) {
      return true
    }

    // Creator can access their assessments
    if (assessment.createdById === userId) {
      return true
    }

    // Trainer can access if assigned to the subject or course
    if (userRole === 'TRAINER') {
      // Check if trainer is assigned to the specific subject (for subject-level assessments)
      if (assessment.subject?.examiners.some((inst) => inst.trainerUserId === userId)) {
        return true
      }

      // Check if trainer is assigned to any subject in the course (for course-level assessments)
      if (
        assessment.course?.subjects.some((subject) => subject.examiners.some((inst) => inst.trainerUserId === userId))
      ) {
        return true
      }
    }

    // Department head can access assessments in their department
    if (userRole === 'DEPARTMENT_HEAD') {
      const userDept = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true }
      })

      return userDept?.departmentId === assessment.template.department?.id
    }

    return false
  }

  /**
   * Get assessments for a specific subject with trainer access check and pagination
   */
  async getSubjectAssessments(
    subjectId: string,
    trainerId: string,
    page: number = 1,
    limit: number = 10,
    status?: AssessmentStatus,
    search?: string
  ) {
    // First verify that the trainer is assigned to this subject
    const trainerAssignment = await this.prisma.assessmentExaminer.findFirst({
      where: {
        subjectId,
        trainerUserId: trainerId
      }
    })

    if (!trainerAssignment) {
      throw new Error('Trainer is not assigned to this subject')
    }

    const skip = (page - 1) * limit

    // Build where clause
    const whereClause: Prisma.AssessmentFormWhereInput = {
      subjectId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          {
            trainee: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { eid: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
              ]
            }
          }
        ]
      })
    }

    // Get total count
    const totalItems = await this.prisma.assessmentForm.count({
      where: whereClause
    })

    // Get assessments with trainee info
    const assessments = await this.prisma.assessmentForm.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        subjectId: true,
        courseId: true,
        occuranceDate: true,
        status: true,
        resultScore: true,
        resultText: true,
        pdfUrl: true,
        comment: true,
        trainee: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        occuranceDate: 'desc'
      },
      skip,
      take: limit
    })

    // Get subject info
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: {
        id: true,
        name: true,
        code: true,
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    })

    if (!subject) {
      throw new Error('Subject not found')
    }

    const totalPages = Math.ceil(totalItems / limit)

    // Transform data to match the expected format
    const transformedAssessments = assessments.map((assessment) => ({
      ...assessment,
      trainee: {
        id: assessment.trainee.id,
        eid: assessment.trainee.eid,
        fullName:
          `${assessment.trainee.firstName}${assessment.trainee.middleName ? ' ' + assessment.trainee.middleName : ''} ${assessment.trainee.lastName}`.trim(),
        email: assessment.trainee.email
      }
    }))

    return {
      assessments: transformedAssessments,
      totalItems,
      page,
      limit,
      totalPages,
      subjectInfo: subject
    }
  }

  /**
   * Get assessments for a specific course with trainer access check and pagination
   */
  async getCourseAssessments(
    courseId: string,
    trainerId: string,
    page: number = 1,
    limit: number = 10,
    status?: AssessmentStatus,
    search?: string
  ) {
    // First verify that the trainer is assigned to this course (through subjects)
    const trainerAssignment = await this.prisma.assessmentExaminer.findFirst({
      where: {
        trainerUserId: trainerId,
        subject: {
          courseId
        }
      }
    })

    if (!trainerAssignment) {
      throw new Error('Trainer is not assigned to any subjects in this course')
    }

    const skip = (page - 1) * limit

    // Build where clause
    const whereClause: Prisma.AssessmentFormWhereInput = {
      courseId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          {
            trainee: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { eid: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
              ]
            }
          }
        ]
      })
    }

    // Get total count
    const totalItems = await this.prisma.assessmentForm.count({
      where: whereClause
    })

    // Get assessments with trainee info
    const assessments = await this.prisma.assessmentForm.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        subjectId: true,
        courseId: true,
        occuranceDate: true,
        status: true,
        resultScore: true,
        resultText: true,
        pdfUrl: true,
        comment: true,
        trainee: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        occuranceDate: 'desc'
      },
      skip,
      take: limit
    })

    // Get course info
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        code: true
      }
    })

    if (!course) {
      throw new Error('Course not found')
    }

    const totalPages = Math.ceil(totalItems / limit)

    // Transform data to match the expected format
    const transformedAssessments = assessments.map((assessment) => ({
      ...assessment,
      trainee: {
        id: assessment.trainee.id,
        eid: assessment.trainee.eid,
        fullName:
          `${assessment.trainee.firstName}${assessment.trainee.middleName ? ' ' + assessment.trainee.middleName : ''} ${assessment.trainee.lastName}`.trim(),
        email: assessment.trainee.email
      }
    }))

    return {
      assessments: transformedAssessments,
      totalItems,
      page,
      limit,
      totalPages,
      courseInfo: course
    }
  }
}

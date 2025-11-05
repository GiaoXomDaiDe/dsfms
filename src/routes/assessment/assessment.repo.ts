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
            status: {
              in: ['ON_GOING', 'FINISHED']
            },
            subject: {
              status: {
                in: ['ON_GOING', 'COMPLETED']
              }
            }
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
            status: {
              in: ['ON_GOING', 'FINISHED']
            },
            subject: {
              status: {
                in: ['ON_GOING', 'COMPLETED']
              }
            }
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
      enrollmentStatus: trainee.subjectEnrollments[0]?.status || 'NOT_STARTED'
    }))
  }

  /**
   * Get trainees enrolled in ANY subject within a specific course
   * For course-level assessments, we include trainees who are enrolled in at least one subject in the course
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
              courseId,
              status: {
                in: ['ON_GOING', 'COMPLETED'] // Only consider ongoing or completed subjects
              }
            },
            status: {
              in: ['ON_GOING', 'FINISHED']
            }
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
              courseId,
              status: {
                in: ['ON_GOING', 'COMPLETED']
              }
            },
            status: {
              in: ['ON_GOING', 'FINISHED']
            }
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
      enrollmentStatus: trainee.subjectEnrollments[0]?.status || 'ON_GOING'
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
          status: {
            in: ['ON_GOING', 'FINISHED']
          },
          subject: {
            status: {
              in: ['ON_GOING', 'COMPLETED']
            }
          }
        }
      }
    }

    if (courseId) {
      whereClause.subjectEnrollments = {
        some: {
          subject: {
            courseId,
            status: {
              in: ['ON_GOING', 'COMPLETED']
            }
          },
          status: {
            in: ['ON_GOING', 'FINISHED']
          }
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
            instructors: {
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
                instructors: {
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
      if (assessment.subject?.instructors.some((inst) => inst.trainerUserId === userId)) {
        return true
      }

      // Check if trainer is assigned to any subject in the course (for course-level assessments)
      if (
        assessment.course?.subjects.some((subject) => subject.instructors.some((inst) => inst.trainerUserId === userId))
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
    const trainerAssignment = await this.prisma.subjectInstructor.findFirst({
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
    // First verify that the trainer is assigned to this course (directly or through its subjects)
    const trainerAssignment = await this.prisma.courseInstructor.findFirst({
      where: {
        trainerUserId: trainerId,
        courseId
      }
    })

    if (!trainerAssignment) {
      const subjectLevelAssignment = await this.prisma.subjectInstructor.findFirst({
        where: {
          trainerUserId: trainerId,
          subject: {
            courseId
          }
        }
      })

      if (!subjectLevelAssignment) {
        throw new Error('Trainer is not assigned to any subjects in this course')
      }
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

  /**
   * Get assessment sections that a user can assess based on their role permissions
   */
  async getAssessmentSections(assessmentId: string, userId: string) {
    // First, get the assessment with all necessary information
    const assessment = await this.prisma.assessmentForm.findUnique({
      where: { id: assessmentId },
      include: {
        template: {
          select: {
            id: true,
            name: true
          }
        },
        trainee: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true
          }
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        sections: {
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
                eid: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: {
            templateSection: {
              displayOrder: 'asc'
            }
          }
        }
      }
    })

    if (!assessment) {
      throw new Error('Assessment not found')
    }

    // Get user's role in the course/subject
    let userRoleInAssessment: string | null = null

    if (assessment.subjectId) {
      // Check if user is instructor for this subject
      const subjectInstructor = await this.prisma.subjectInstructor.findFirst({
        where: {
          subjectId: assessment.subjectId,
          trainerUserId: userId
        },
        select: {
          roleInAssessment: true
        }
      })
      userRoleInAssessment = subjectInstructor?.roleInAssessment || null
    } else if (assessment.courseId) {
      // Check if user is instructor for this course
      const courseInstructor = await this.prisma.courseInstructor.findFirst({
        where: {
          courseId: assessment.courseId,
          trainerUserId: userId
        },
        select: {
          roleInAssessment: true
        }
      })
      userRoleInAssessment = courseInstructor?.roleInAssessment || null
    }

    // Get user's main role for fallback
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: {
          select: {
            name: true
          }
        }
      }
    })

    const userMainRole = user?.role.name || 'UNKNOWN'

    // Process sections and filter only sections user can access
    const sectionsWithPermissions = assessment.sections
      .map(section => {
        let canAssess = false
        let roleRequirement: string | null = null

        // Determine if user can assess this section
        if (section.templateSection.editBy === 'TRAINER') {
          // Section requires trainer access
          if (userMainRole === 'TRAINER') {
            // Check if section requires specific role in subject/course
            if (section.templateSection.roleInSubject) {
              // Section requires specific assessment role
              roleRequirement = section.templateSection.roleInSubject
              canAssess = userRoleInAssessment === section.templateSection.roleInSubject
            } else {
              // Section just requires trainer role
              roleRequirement = 'TRAINER'
              canAssess = userRoleInAssessment !== null // Must be assigned to subject/course
            }
          }
        } else if (section.templateSection.editBy === 'TRAINEE') {
          // Section requires trainee access
          roleRequirement = 'TRAINEE'
          canAssess = userMainRole === 'TRAINEE' && assessment.traineeId === userId
        }

        return {
          section,
          canAssess,
          roleRequirement
        }
      })
      .filter(item => item.canAssess) // Only return sections user can assess
      .map((item, index) => {
        // Re-number displayOrder sequentially for filtered sections
        const frontendDisplayOrder = index + 1

        return {
          id: item.section.id,
          assessmentFormId: item.section.assessmentFormId,
          assessedById: item.section.assessedById,
          status: item.section.status,
          createdAt: item.section.createdAt,
          templateSection: {
            id: item.section.templateSection.id,
            label: item.section.templateSection.label,
            displayOrder: frontendDisplayOrder, // Sequential order for filtered sections
            editBy: item.section.templateSection.editBy,
            roleInSubject: item.section.templateSection.roleInSubject,
            isSubmittable: item.section.templateSection.isSubmittable,
            isToggleDependent: item.section.templateSection.isToggleDependent
          },
          assessedBy: item.section.assessedBy ? {
            id: item.section.assessedBy.id,
            firstName: item.section.assessedBy.firstName,
            lastName: item.section.assessedBy.lastName,
            eid: item.section.assessedBy.eid
          } : null,
          canAssess: true, // All returned sections can be assessed
          roleRequirement: item.roleRequirement
        }
      })

    const sectionsCanAssess = sectionsWithPermissions.length

    return {
      success: true,
      message: 'Assessment sections retrieved successfully',
      assessmentInfo: {
        id: assessment.id,
        name: assessment.name,
        trainee: {
          id: assessment.trainee.id,
          firstName: assessment.trainee.firstName,
          lastName: assessment.trainee.lastName,
          eid: assessment.trainee.eid
        },
        template: {
          id: assessment.template.id,
          name: assessment.template.name
        },
        subject: assessment.subject ? {
          id: assessment.subject.id,
          name: assessment.subject.name,
          code: assessment.subject.code
        } : null,
        course: assessment.course ? {
          id: assessment.course.id,
          name: assessment.course.name,
          code: assessment.course.code
        } : null,
        occuranceDate: assessment.occuranceDate,
        status: assessment.status
      },
      sections: sectionsWithPermissions,
      userRole: userRoleInAssessment || userMainRole,
      totalSections: sectionsWithPermissions.length,
      sectionsCanAssess
    }
  }

  /**
   * Get all fields of an assessment section with their template field information and assessment values
   */
  async getAssessmentSectionFields(assessmentSectionId: string) {
    // First, get the assessment section with template section info
    const assessmentSection = await this.prisma.assessmentSection.findUnique({
      where: { id: assessmentSectionId },
      include: {
        templateSection: {
          select: {
            id: true,
            label: true,
            displayOrder: true,
            editBy: true,
            roleInSubject: true,
            isSubmittable: true,
            isToggleDependent: true,
            fields: {
              orderBy: {
                displayOrder: 'asc'
              },
              select: {
                id: true,
                label: true,
                fieldName: true,
                fieldType: true,
                roleRequired: true,
                options: true,
                displayOrder: true,
                parentId: true
              }
            }
          }
        },
        values: {
          select: {
            id: true,
            templateFieldId: true,
            answerValue: true
          }
        }
      }
    })

    if (!assessmentSection) {
      throw new Error('Assessment section not found')
    }

    // Create a map of assessment values by template field ID for quick lookup
    const assessmentValueMap = new Map<string, { id: string; answerValue: string | null }>()
    assessmentSection.values.forEach(value => {
      assessmentValueMap.set(value.templateFieldId, {
        id: value.id,
        answerValue: value.answerValue
      })
    })

    // Map template fields with their corresponding assessment values
    const fieldsWithValues = assessmentSection.templateSection.fields.map(templateField => ({
      templateField: {
        id: templateField.id,
        label: templateField.label,
        fieldName: templateField.fieldName,
        fieldType: templateField.fieldType,
        roleRequired: templateField.roleRequired,
        options: templateField.options,
        displayOrder: templateField.displayOrder,
        parentId: templateField.parentId
      },
      assessmentValue: assessmentValueMap.get(templateField.id) || {
        id: '', // This shouldn't happen if data is consistent
        answerValue: null
      }
    }))

    return {
      success: true,
      message: 'Assessment section fields retrieved successfully',
      assessmentSectionInfo: {
        id: assessmentSection.id,
        assessmentFormId: assessmentSection.assessmentFormId,
        templateSectionId: assessmentSection.templateSectionId,
        status: assessmentSection.status,
        templateSection: {
          id: assessmentSection.templateSection.id,
          label: assessmentSection.templateSection.label,
          displayOrder: assessmentSection.templateSection.displayOrder,
          editBy: assessmentSection.templateSection.editBy,
          roleInSubject: assessmentSection.templateSection.roleInSubject,
          isSubmittable: assessmentSection.templateSection.isSubmittable,
          isToggleDependent: assessmentSection.templateSection.isToggleDependent
        }
      },
      fields: fieldsWithValues,
      totalFields: fieldsWithValues.length
    }
  }

  /**
   * Save assessment values and update section status
   */
  async saveAssessmentValues(
    assessmentSectionId: string, 
    values: Array<{ assessmentValueId: string; answerValue: string | null }>,
    userId: string
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // Update each assessment value
      let updatedCount = 0
      for (const value of values) {
        await tx.assessmentValue.update({
          where: { id: value.assessmentValueId },
          data: { answerValue: value.answerValue }
        })
        updatedCount++
      }

      // Update assessment section status and assessedById
      const updatedSection = await tx.assessmentSection.update({
        where: { id: assessmentSectionId },
        data: {
          status: AssessmentSectionStatus.DRAFT,
          assessedById: userId
        },
        include: {
          assessmentForm: {
            include: {
              sections: {
                select: {
                  status: true
                }
              }
            }
          }
        }
      })

      // Check if assessment form should be updated to DRAFT
      let newAssessmentStatus = updatedSection.assessmentForm.status
      if (newAssessmentStatus === AssessmentStatus.NOT_STARTED) {
        newAssessmentStatus = AssessmentStatus.DRAFT
      }

      // Check if all sections are DRAFT to make it READY_TO_SUBMIT
      const allSectionsDraft = updatedSection.assessmentForm.sections.every(
        section => section.status === AssessmentSectionStatus.DRAFT
      )
      
      if (allSectionsDraft && 
          (newAssessmentStatus === AssessmentStatus.DRAFT || 
           newAssessmentStatus === AssessmentStatus.SIGNATURE_PENDING)) {
        newAssessmentStatus = AssessmentStatus.READY_TO_SUBMIT
      }

      // Update assessment form status if needed
      if (newAssessmentStatus !== updatedSection.assessmentForm.status) {
        await tx.assessmentForm.update({
          where: { id: updatedSection.assessmentFormId },
          data: { status: newAssessmentStatus }
        })
      }

      return {
        success: true,
        message: 'Assessment values saved successfully',
        assessmentSectionId: assessmentSectionId,
        updatedValues: updatedCount,
        sectionStatus: AssessmentSectionStatus.DRAFT,
        assessmentFormStatus: newAssessmentStatus
      }
    })
  }

  /**
   * Toggle trainee lock status with date and trainee section validation
   */
  async toggleTraineeLock(assessmentId: string, isTraineeLocked: boolean, userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      // Get assessment with template sections
      const assessment = await tx.assessmentForm.findUnique({
        where: { id: assessmentId },
        include: {
          template: {
            include: {
              sections: {
                select: {
                  editBy: true,
                  roleInSubject: true
                }
              }
            }
          },
          sections: {
            include: {
              templateSection: {
                select: {
                  editBy: true,
                  roleInSubject: true
                }
              }
            }
          }
        }
      })

      if (!assessment) {
        throw new Error('Assessment not found')
      }

      // Check if today is the occurrence date
      const today = new Date()
      const occurrenceDate = new Date(assessment.occuranceDate)
      const isSameDate = today.toDateString() === occurrenceDate.toDateString()

      if (!isSameDate) {
        throw new Error('Can only toggle trainee lock on the occurrence date')
      }

      // Check if assessment has trainee sections
      const hasTraineeSections = assessment.template.sections.some(
        section => section.editBy === 'TRAINEE'
      )

      if (!hasTraineeSections) {
        throw new Error('Assessment does not have any trainee sections')
      }

      // Determine new status based on lock state and trainee sections
      let newStatus: AssessmentStatus

      if (!isTraineeLocked) {
        // Switching to false (unlocked) - allows trainee input
        newStatus = AssessmentStatus.SIGNATURE_PENDING
      } else {
        // Switching to true (locked) - check ALL section completion
        const allSectionsDraft = assessment.sections.every(
          section => section.status === AssessmentSectionStatus.DRAFT
        )

        if (allSectionsDraft) {
          // All sections (TRAINER + TRAINEE) are completed
          newStatus = AssessmentStatus.READY_TO_SUBMIT
        } else {
          // Some sections still not completed (either TRAINER or TRAINEE)
          newStatus = AssessmentStatus.DRAFT
        }
      }

      // Update assessment form
      const updatedAssessment = await tx.assessmentForm.update({
        where: { id: assessmentId },
        data: {
          isTraineeLocked,
          status: newStatus
        }
      })

      return {
        success: true,
        message: `Trainee lock ${isTraineeLocked ? 'enabled' : 'disabled'} successfully`,
        assessmentFormId: assessmentId,
        isTraineeLocked,
        status: newStatus
      }
    })
  }

  /**
   * Submit assessment with submittable section validation
   */
  async submitAssessment(assessmentId: string, userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      // Get assessment with all sections
      const assessment = await tx.assessmentForm.findUnique({
        where: { id: assessmentId },
        include: {
          sections: {
            include: {
              templateSection: {
                select: {
                  isSubmittable: true
                }
              }
            }
          }
        }
      })

      if (!assessment) {
        throw new Error('Assessment not found')
      }

      // Check if status is READY_TO_SUBMIT
      if (assessment.status !== AssessmentStatus.READY_TO_SUBMIT) {
        throw new Error('Assessment is not ready to submit')
      }

      // Check if all sections are DRAFT
      const allSectionsDraft = assessment.sections.every(
        section => section.status === AssessmentSectionStatus.DRAFT
      )

      if (!allSectionsDraft) {
        throw new Error('All sections must be completed before submission')
      }

      // Check if user filled any submittable sections
      const submittableSections = assessment.sections.filter(
        section => section.templateSection.isSubmittable
      )

      const userFilledSubmittableSection = submittableSections.some(
        section => section.assessedById === userId
      )

      if (!userFilledSubmittableSection) {
        throw new Error('You must complete at least one submittable section to submit this assessment')
      }

      // Update assessment to submitted
      const submittedAssessment = await tx.assessmentForm.update({
        where: { id: assessmentId },
        data: {
          status: AssessmentStatus.SUBMITTED,
          submittedAt: new Date()
        }
      })

      return {
        success: true,
        message: 'Assessment submitted successfully',
        assessmentFormId: assessmentId,
        submittedAt: submittedAssessment.submittedAt!,
        submittedBy: userId,
        status: AssessmentStatus.SUBMITTED
      }
    })
  }

  /**
   * Update assessment values (only by the user who originally assessed the section)
   */
  async updateAssessmentValues(
    assessmentSectionId: string,
    values: Array<{ assessmentValueId: string; answerValue: string | null }>,
    userId: string
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // First check if the user is the one who assessed this section
      const assessmentSection = await tx.assessmentSection.findUnique({
        where: { id: assessmentSectionId },
        select: {
          assessedById: true,
          status: true
        }
      })

      if (!assessmentSection) {
        throw new Error('Assessment section not found')
      }

      if (assessmentSection.assessedById !== userId) {
        throw new Error('Only the user who originally assessed this section can update the values')
      }

      if (assessmentSection.status !== AssessmentSectionStatus.DRAFT) {
        throw new Error('Can only update values for sections in DRAFT status')
      }

      // Update each assessment value
      let updatedCount = 0
      for (const value of values) {
        await tx.assessmentValue.update({
          where: { id: value.assessmentValueId },
          data: { answerValue: value.answerValue }
        })
        updatedCount++
      }

      return {
        success: true,
        message: 'Assessment values updated successfully',
        assessmentSectionId: assessmentSectionId,
        updatedValues: updatedCount,
        sectionStatus: assessmentSection.status
      }
    })
  }
}

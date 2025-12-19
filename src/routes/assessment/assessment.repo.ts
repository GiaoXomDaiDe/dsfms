import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { AssessmentResult, AssessmentSectionStatus, AssessmentStatus, Prisma, RoleInSubject } from '@prisma/client'
import { SerializeAll } from '~/shared/decorators/serialize.decorator'
import { PrismaService } from '~/shared/services/prisma.service'
import z from 'zod'
import {
  AssessmentFormResType,
  CreateAssessmentBodyType,
  GetAssessmentDetailResType,
  GetAssessmentsQueryType,
  GetAssessmentsResType,
  GetDepartmentAssessmentsQueryType,
  GetDepartmentAssessmentsResType,
  DepartmentAssessmentItemType,
  GetAssessmentEventsQueryType,
  GetAssessmentEventsResType,
  GetUserAssessmentEventsQueryType,
  GetUserAssessmentEventsResType,
  UpdateAssessmentEventBodyType,
  UpdateAssessmentEventParamsType,
  UpdateAssessmentEventResType,
  AssessmentEventStatus,
  GetEventSubjectAssessmentsBodyType,
  GetEventSubjectAssessmentsQueryType,
  GetEventSubjectAssessmentsResType,
  GetEventCourseAssessmentsBodyType,
  GetEventCourseAssessmentsQueryType,
  GetEventCourseAssessmentsResType,
  GetDepartmentAssessmentEventsQueryType,
  GetDepartmentAssessmentEventsResType
} from './assessment.model'
import {
  AssessmentSectionNotFoundError,
  OriginalAssessorOnlyError,
  SectionDraftStatusOnlyError,
  AssessmentStatusNotAllowedError,
  TrainerNotAssignedToSubjectError,
  TrainerNotAssignedToCourseError,
  TraineeNoAssessmentsInSubjectError,
  TraineeNoAssessmentsInCourseError,
  SubjectNotFoundError,
  CourseNotFoundError,
  AccessDeniedError,
  AssessmentNotReadyToSubmitError,
  SubmittableSectionNotCompletedError,
  OccurrenceDateNotTodayError,
  TraineeSectionsNotFoundError
} from './assessment.error'
import { ASSESSMENT_MESSAGES } from './assessment.message'

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
              in: ['ENROLLED', 'ON_GOING', 'FINISHED']
            },
            subject: {
              status: {
                in: ['PLANNED', 'ON_GOING', 'COMPLETED']
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
              in: ['ENROLLED', 'ON_GOING', 'FINISHED']
            },
            subject: {
              status: {
                in: ['PLANNED', 'ON_GOING', 'COMPLETED']
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
      enrollmentStatus: trainee.subjectEnrollments[0]?.status || 'ON_GOING'
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
                in: ['PLANNED', 'ON_GOING', 'COMPLETED'] // Only consider ongoing or completed subjects
              }
            },
            status: {
              in: ['ENROLLED', 'ON_GOING', 'FINISHED']
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
                in: ['PLANNED', 'ON_GOING', 'COMPLETED']
              }
            },
            status: {
              in: ['ENROLLED', 'ON_GOING', 'FINISHED']
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
    console.log(`Starting createAssessments with data:`, {
      name: assessmentData.name,
      traineeCount: assessmentData.traineeIds.length,
      sectionCount: templateSections.length
    })

    try {
      return await this.prisma.$transaction(
        async (tx) => {
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

          // Determine initial status based on occurrence date
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const occurrenceDate = new Date(assessmentData.occuranceDate)
          occurrenceDate.setHours(0, 0, 0, 0)

          // If occurrence date is today, start with ON_GOING, otherwise NOT_STARTED (future dates)
          // Past dates are prevented at service layer validation
          const initialStatus =
            occurrenceDate.getTime() === today.getTime() ? AssessmentStatus.ON_GOING : AssessmentStatus.NOT_STARTED

          // Get trainee EIDs for name formatting
          const trainees = await tx.user.findMany({
            where: {
              id: { in: assessmentData.traineeIds }
            },
            select: {
              id: true,
              eid: true
            }
          })

          const traineeEidMap = new Map(trainees.map((t) => [t.id, t.eid]))

          for (const traineeId of assessmentData.traineeIds) {
            // Get trainee EID and format assessment name with dash separator
            const traineeEid = traineeEidMap.get(traineeId)
            const assessmentName = `${assessmentData.name} - ${traineeEid}`

            // Create the main assessment form
            const assessmentForm = await tx.assessmentForm.create({
              data: {
                templateId: assessmentData.templateId,
                name: assessmentName,
                subjectId: assessmentData.subjectId || null,
                courseId: courseId || null,
                occuranceDate: assessmentData.occuranceDate,
                createdById,
                updatedById: createdById,
                traineeId,
                status: initialStatus,
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

            // Batch create assessment sections for all template sections
            const sectionsToCreate = templateSections.map((templateSection) => ({
              assessmentFormId: assessmentForm.id,
              templateSectionId: templateSection.id,
              status: AssessmentSectionStatus.REQUIRED_ASSESSMENT,
              assessedById: null
            }))

            const createdSections = await tx.assessmentSection.createManyAndReturn({
              data: sectionsToCreate
            })

            // Batch create assessment values for all fields in all sections
            const valuesToCreate = []
            for (let i = 0; i < templateSections.length; i++) {
              const templateSection = templateSections[i]
              const assessmentSection = createdSections[i]

              for (const field of templateSection.fields) {
                valuesToCreate.push({
                  assessmentSectionId: assessmentSection.id,
                  templateFieldId: field.id,
                  answerValue: null,
                  createdById
                })
              }
            }

            // Batch create all assessment values at once
            if (valuesToCreate.length > 0) {
              await tx.assessmentValue.createMany({
                data: valuesToCreate
              })
            }

            createdAssessments.push(assessmentForm as AssessmentFormResType)
          }

          console.log(`Successfully created ${createdAssessments.length} assessments`)
          return createdAssessments
        },
        {
          timeout: 120000 // 120 seconds timeout for bulk operations
        }
      )
    } catch (error) {
      console.error('Transaction failed in createAssessments:', {
        error: error.message,
        code: error.code,
        traineeCount: assessmentData.traineeIds.length
      })
      throw error
    }
  }

  /**
   * Check if assessments already exist for the given trainees on the specified date
   */
  // async checkDuplicateAssessments(
  //   traineeIds: string[],
  //   templateId: string,
  //   occuranceDate: Date,
  //   subjectId?: string,
  //   courseId?: string
  // ): Promise<Array<{ traineeId: string; traineeName: string }>> {
  //   const whereClause: Prisma.AssessmentFormWhereInput = {
  //     traineeId: { in: traineeIds },
  //     templateId,
  //     occuranceDate
  //   }

  //   if (subjectId) {
  //     whereClause.subjectId = subjectId
  //   }
  //   if (courseId) {
  //     whereClause.courseId = courseId
  //   }

  //   const existingAssessments = await this.prisma.assessmentForm.findMany({
  //     where: whereClause,
  //     select: {
  //       traineeId: true,
  //       trainee: {
  //         select: {
  //           firstName: true,
  //           lastName: true,
  //           middleName: true
  //         }
  //       }
  //     }
  //   })

  //   return existingAssessments.map((assessment) => ({
  //     traineeId: assessment.traineeId,
  //     traineeName:
  //       `${assessment.trainee.firstName} ${assessment.trainee.middleName || ''} ${assessment.trainee.lastName}`.trim()
  //   }))
  // }

  /**
   * Check if any assessment form already exists for trainee with the same template and occurrence date
   */
  async checkTraineeAssessmentExists(
    traineeIds: string[],
    templateId: string,
    occuranceDate: Date,
    subjectId?: string,
    courseId?: string
  ): Promise<Array<{ traineeId: string; traineeName: string; assessmentId: string }>> {
    const whereClause: Prisma.AssessmentFormWhereInput = {
      traineeId: { in: traineeIds },
      templateId,
      occuranceDate,
      ...(subjectId && { subjectId }),
      ...(courseId && { courseId })
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
   * Get template with its sections and fields - only PUBLISHED templates can be used for assessments
   */
  async getTemplateWithStructure(templateId: string) {
    return await this.prisma.templateForm.findUnique({
      where: {
        id: templateId,
        status: 'PUBLISHED' // Only PUBLISHED templates can be used to create assessments
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
    // Debug logging
    // console.log('=== checkAssessmentAccess START ===', {
    //   assessmentId,
    //   userId,
    //   userRole
    // })

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
            instructors: {
              select: {
                trainerUserId: true
              }
            }
          }
        }
      }
    })

    if (!assessment) {
      // console.log('Assessment not found:', assessmentId)
      return false
    }

    // console.log('Assessment found:', {
    //   traineeId: assessment.traineeId,
    //   createdById: assessment.createdById,
    //   subjectId: assessment.subjectId,
    //   courseId: assessment.courseId,
    //   templateDeptId: assessment.template.department?.id
    // })

    // Trainee can access their own assessments
    if (userRole === 'TRAINEE' && assessment.traineeId === userId) {
      // console.log('TRAINEE access granted')
      return true
    }

    // Creator can access their assessments
    if (assessment.createdById === userId) {
      return true
    }

    // Trainer can access if assigned to the subject or course
    if (userRole === 'TRAINER') {
      // For subject-level assessments (subjectId is not null)
      if (assessment.subjectId && assessment.subject?.instructors.some((inst) => inst.trainerUserId === userId)) {
        return true
      }

      // For course-level assessments (courseId is not null, subjectId is null)
      // Check if trainer is directly assigned as course instructor
      if (
        assessment.courseId &&
        !assessment.subjectId &&
        assessment.course?.instructors.some((inst) => inst.trainerUserId === userId)
      ) {
        return true
      }
    }

    // Department head can access assessments in their department
    if (userRole === 'DEPARTMENT_HEAD' || userRole === 'DEPARTMENT HEAD') {
      const userDept = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true }
      })

      // Debug logging (remove in production)
      // console.log('DEPARTMENT_HEAD Access Check:', {
      //   userId,
      //   userDepartmentId: userDept?.departmentId,
      //   templateDepartmentId: assessment.template.department?.id,
      //   assessmentId,
      //   hasUserDept: !!userDept?.departmentId,
      //   hasTemplateDept: !!assessment.template.department?.id
      // })

      return userDept?.departmentId === assessment.template.department?.id
    }

    // console.log('=== checkAssessmentAccess END: Access DENIED ===')
    return false
  }

  /**
   * Get assessments for a specific subject with trainer/trainee access check and pagination
   */
  async getSubjectAssessments(
    subjectId: string,
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 1000,
    status?: AssessmentStatus,
    search?: string
  ) {
    const whereClause: Prisma.AssessmentFormWhereInput = {
      subjectId,
      ...(status && { status })
    }

    // Handle different user roles
    if (userRole === 'TRAINEE') {
      // Trainees can only see their own assessments
      whereClause.traineeId = userId
    } else if (userRole === 'TRAINER') {
      // For trainers, check their role in assessment and filter accordingly
      const trainerAssignment = await this.prisma.subjectInstructor.findFirst({
        where: {
          subjectId,
          trainerUserId: userId
        },
        select: {
          roleInAssessment: true
        }
      })

      if (!trainerAssignment) {
        throw TrainerNotAssignedToSubjectError
      }

      // Get all assessments that have sections requiring this trainer's role
      const assessmentsWithMatchingRole = await this.prisma.assessmentForm.findMany({
        where: {
          subjectId,
          sections: {
            some: {
              templateSection: {
                OR: [
                  { roleInSubject: trainerAssignment.roleInAssessment },
                  { roleInSubject: null, editBy: 'TRAINER' } // Sections that don't require specific role but need trainer
                ]
              }
            }
          }
        },
        select: { id: true }
      })

      const relevantAssessmentIds = assessmentsWithMatchingRole.map((a) => a.id)

      if (relevantAssessmentIds.length === 0) {
        // No assessments found with sections matching this trainer's role
        whereClause.id = { in: [] } // This will return empty results
      } else {
        whereClause.id = { in: relevantAssessmentIds }
      }
    } else {
      throw new Error('Access denied')
    }

    // Add search functionality to the existing where clause
    if (search) {
      whereClause.OR = [
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
    }

    const skip = (page - 1) * limit

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
        isTraineeLocked: true,
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
      throw SubjectNotFoundError
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
   * Get assessments for a specific course with trainer/TRAINEE access check and pagination
   */
  async getCourseAssessments(
    courseId: string,
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 1000,
    status?: AssessmentStatus,
    search?: string
  ) {
    const whereClause: Prisma.AssessmentFormWhereInput = {
      courseId,
      subjectId: null, // Only course-level assessments (not subject-level)
      ...(status && { status })
    }

    // Handle different user roles
    if (userRole === 'TRAINEE') {
      // Trainees can only see their own assessments
      whereClause.traineeId = userId
    } else if (userRole === 'TRAINER') {
      // For course scope, only check CourseInstructor table
      const courseAssignment = await this.prisma.courseInstructor.findFirst({
        where: {
          trainerUserId: userId,
          courseId
        },
        select: {
          roleInAssessment: true
        }
      })

      if (!courseAssignment) {
        throw TrainerNotAssignedToCourseError
      }

      const trainerRoleInAssessment = courseAssignment.roleInAssessment

      // Get all assessments that have sections requiring this trainer's role
      const assessmentsWithMatchingRole = await this.prisma.assessmentForm.findMany({
        where: {
          courseId,
          sections: {
            some: {
              templateSection: {
                OR: [
                  { roleInSubject: trainerRoleInAssessment },
                  { roleInSubject: null, editBy: 'TRAINER' } // Sections that don't require specific role but need trainer
                ]
              }
            }
          }
        },
        select: { id: true }
      })

      const relevantAssessmentIds = assessmentsWithMatchingRole.map((a) => a.id)

      if (relevantAssessmentIds.length === 0) {
        // No assessments found with sections matching this trainer's role
        whereClause.id = { in: [] } // This will return empty results
      } else {
        whereClause.id = { in: relevantAssessmentIds }
      }
    } else {
      throw new Error('Access denied')
    }

    // Add search functionality to the existing where clause
    if (search) {
      whereClause.OR = [
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
    }

    const skip = (page - 1) * limit

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
        isTraineeLocked: true,
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
      throw CourseNotFoundError
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
   * Get all assessments for a specific trainee (not filtered by course/subject)
   */
  async getTraineeAssessments(
    traineeUserId: string,
    page: number = 1,
    limit: number = 1000,
    status?: AssessmentStatus,
    search?: string
  ) {
    const whereClause: Prisma.AssessmentFormWhereInput = {
      traineeId: traineeUserId,
      ...(status && { status })
    }

    // Add search functionality
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        {
          subject: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } }
            ]
          }
        },
        {
          course: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } }
            ]
          }
        }
      ]
    }

    const skip = (page - 1) * limit

    // Get total count
    const totalItems = await this.prisma.assessmentForm.count({
      where: whereClause
    })

    // Get assessments without trainee info (since this endpoint is for the current trainee only)
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
        isTraineeLocked: true
      },
      orderBy: {
        occuranceDate: 'desc'
      },
      skip,
      take: limit
    })

    const totalPages = Math.ceil(totalItems / limit)

    return {
      assessments: assessments,
      totalItems,
      page,
      limit,
      totalPages
    }
  }

  /**
   * Get assessments for a department (for Department Head)
   * Permanently blocks access to assessments in early stages (NOT_STARTED, ON_GOING, SIGNATURE_PENDING, DRAFT, READY_TO_SUBMIT)
   * Only allows access to completed workflow assessments (SUBMITTED, APPROVED, REJECTED, CANCELLED)
   * Blocked statuses cannot be accessed even when explicitly queried
   */
  async getDepartmentAssessments(
    departmentId: string,
    page: number = 1,
    limit: number = 1000,
    status?: AssessmentStatus,
    templateId?: string,
    subjectId?: string,
    courseId?: string,
    traineeId?: string,
    fromDate?: Date,
    toDate?: Date,
    search?: string
  ): Promise<GetDepartmentAssessmentsResType> {
    const whereClause: Prisma.AssessmentFormWhereInput = {
      OR: [
        // Assessments in subjects that belong to courses in this department
        {
          subject: {
            course: {
              departmentId
            }
          }
        },
        // Assessments in courses directly in this department
        {
          course: {
            departmentId
          }
        }
      ],
      // Exclude assessments with these statuses
      status: {
        notIn: [
          AssessmentStatus.NOT_STARTED,
          AssessmentStatus.ON_GOING,
          AssessmentStatus.SIGNATURE_PENDING,
          AssessmentStatus.DRAFT,
          AssessmentStatus.READY_TO_SUBMIT
        ]
      }
    }

    // Apply status filter only if it's not in the excluded list
    if (status) {
      const excludedStatuses: AssessmentStatus[] = [
        AssessmentStatus.NOT_STARTED,
        AssessmentStatus.ON_GOING,
        AssessmentStatus.SIGNATURE_PENDING,
        AssessmentStatus.DRAFT,
        AssessmentStatus.READY_TO_SUBMIT
      ]

      if (excludedStatuses.includes(status)) {
        // If trying to query an excluded status, return empty result
        whereClause.status = 'INVALID_STATUS' as any // This will match nothing
      } else {
        whereClause.status = status
      }
    }
    if (templateId) whereClause.templateId = templateId
    if (subjectId) whereClause.subjectId = subjectId
    if (courseId) whereClause.courseId = courseId
    if (traineeId) whereClause.traineeId = traineeId

    if (fromDate || toDate) {
      whereClause.occuranceDate = {}
      if (fromDate) whereClause.occuranceDate.gte = fromDate
      if (toDate) whereClause.occuranceDate.lte = toDate
    }

    // Add search functionality
    if (search) {
      const existingAnd = Array.isArray(whereClause.AND) ? whereClause.AND : whereClause.AND ? [whereClause.AND] : []
      whereClause.AND = [
        ...existingAnd,
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { trainee: { firstName: { contains: search, mode: 'insensitive' } } },
            { trainee: { lastName: { contains: search, mode: 'insensitive' } } },
            { trainee: { eid: { contains: search, mode: 'insensitive' } } }
          ]
        }
      ]
    }

    const skip = (page - 1) * limit

    // Get total count
    const totalItems = await this.prisma.assessmentForm.count({
      where: whereClause
    })

    // Get assessments with all related info
    const assessments = await this.prisma.assessmentForm.findMany({
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
            middleName: true,
            lastName: true,
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
      },
      orderBy: {
        occuranceDate: 'desc'
      },
      skip,
      take: limit
    })

    // Get department info
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        name: true,
        code: true
      }
    })

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
    })) as DepartmentAssessmentItemType[]

    return {
      assessments: transformedAssessments,
      totalItems,
      page,
      limit,
      totalPages,
      departmentInfo: department || undefined
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
            name: true,
            templateContent: true
          }
        },
        trainee: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            lastName: true,
            middleName: true,
            traineeProfile: {
              select: {
                userId: true,
                dob: true,
                enrollmentDate: true,
                trainingBatch: true,
                passportNo: true,
                nation: true
              }
            }
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
                isToggleDependent: true,
                fields: {
                  select: {
                    id: true,
                    fieldType: true
                  }
                }
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

    // Get available trainers count from Subject/Course_Instructor
    let availableTrainers = 0
    if (assessment.subjectId) {
      availableTrainers = await this.prisma.subjectInstructor.count({
        where: {
          subjectId: assessment.subjectId
        }
      })
    } else if (assessment.courseId) {
      availableTrainers = await this.prisma.courseInstructor.count({
        where: {
          courseId: assessment.courseId
        }
      })
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

    // Filter out TRAINEE sections that only have SIGNATURE_DRAW fields
    const filteredSections = assessment.sections.filter((section) => {
      // Only filter TRAINEE sections
      if (section.templateSection.editBy === 'TRAINEE') {
        const fields = section.templateSection.fields

        // If section has only one field and it's SIGNATURE_DRAW, exclude it
        if (fields.length === 1 && fields[0].fieldType === 'SIGNATURE_DRAW') {
          return false
        }
      }

      // Keep all other sections
      return true
    })

    // Process sections based on user role - TRAINER can see both TRAINER and TRAINEE sections
    const accessibleSections = filteredSections
      .map((section) => {
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
              // ASSESSMENT_REVIEWER can see all sections (for review purposes)
              if (userRoleInAssessment === 'ASSESSMENT_REVIEWER') {
                canAssess = true
              }
              // EXAMINER can only see sections matching their specific role
              else {
                canAssess = userRoleInAssessment === section.templateSection.roleInSubject
              }
            } else {
              // Section just requires trainer role
              roleRequirement = 'TRAINER'
              canAssess = userRoleInAssessment !== null // Must be assigned to subject/course
            }
          } else if (userMainRole === 'DEPARTMENT HEAD' || userMainRole === 'DEPARTMENT_HEAD' ) {
            // DEPARTMENT_HEAD can see all sections but cannot assess them
            canAssess = true
          }
        } else if (section.templateSection.editBy === 'TRAINEE') {
          // Section requires trainee access
          roleRequirement = 'TRAINEE'
          if (userMainRole === 'TRAINEE') {
            canAssess = assessment.traineeId === userId && !assessment.isTraineeLocked
          } else if (userMainRole === 'TRAINER') {
            // TRAINER can see TRAINEE sections but cannot assess them
            canAssess = true
          } else if (userMainRole === 'DEPARTMENT_HEAD' || userMainRole === 'DEPARTMENT HEAD') {
            // DEPARTMENT_HEAD can see all sections but cannot assess them
            canAssess = true
          }
        }

        return {
          section,
          canAssess,
          roleRequirement
        }
      })
      .filter((item) => item.canAssess) // Only return sections user can access
      .sort((a, b) => a.section.templateSection.displayOrder - b.section.templateSection.displayOrder) // Sort by original order

    // Process sections with new logic for non-sequential assessment
    const sectionsWithPermissions = accessibleSections.map((item, index) => {
      // Re-number displayOrder sequentially for filtered sections
      const frontendDisplayOrder = index + 1

      // Determine canAssessed based on assessedBy field and user permissions
      let canAssessed: boolean | undefined = undefined

      // Basic assessedBy logic: true if not assessed OR assessed by current user, false if assessed by someone else
      const sectionNotAssessed = item.section.assessedById === null
      const sectionAssessedByCurrentUser = item.section.assessedById === userId
      const basicCanAssess = sectionNotAssessed || sectionAssessedByCurrentUser

      if (userMainRole === 'TRAINER') {
        if (item.section.templateSection.editBy === 'TRAINER') {
          // For TRAINER sections, check if they can assess based on role match
          if (item.roleRequirement && userRoleInAssessment) {
            // ASSESSMENT_REVIEWER can only assess sections that specifically require ASSESSMENT_REVIEWER role
            // They can VIEW all sections, but can only ASSESS sections matching their role
            if (userRoleInAssessment === 'ASSESSMENT_REVIEWER') {
              // Can only assess if the section also requires ASSESSMENT_REVIEWER
              canAssessed = item.roleRequirement === 'ASSESSMENT_REVIEWER' ? basicCanAssess : false
            }
            // EXAMINER can only assess sections matching their specific role
            else if (userRoleInAssessment === item.roleRequirement) {
              canAssessed = basicCanAssess
            } else {
              canAssessed = false
            }
          } else {
            canAssessed = false
          }
        } else if (item.section.templateSection.editBy === 'TRAINEE') {
          // For TRAINEE sections, TRAINER can view but cannot assess
          canAssessed = false
        }
      } else if (userMainRole === 'TRAINEE') {
        if (item.section.templateSection.editBy === 'TRAINEE') {
          // For TRAINEE sections, apply basic logic if trainee is not locked
          const traineeNotLocked = !assessment.isTraineeLocked
          canAssessed = traineeNotLocked ? basicCanAssess : false
        } else {
          // TRAINEE cannot assess TRAINER sections
          canAssessed = false
        }
      } else if (userMainRole === 'DEPARTMENT_HEAD' || userMainRole === 'DEPARTMENT HEAD') {
        // DEPARTMENT_HEAD can view all sections but cannot assess any
        canAssessed = false
      }

      const baseSection = {
        id: item.section.id,
        assessmentFormId: item.section.assessmentFormId,
        assessedById: item.section.assessedById,
        status: item.section.status,
        createdAt: item.section.createdAt,
        templateSection: {
          id: item.section.templateSection.id,
          label: item.section.templateSection.label,
          displayOrder: frontendDisplayOrder, // Sequential order for filtered sections (for display only)
          editBy: item.section.templateSection.editBy,
          roleInSubject: item.section.templateSection.roleInSubject,
          isSubmittable: item.section.templateSection.isSubmittable,
          isToggleDependent: item.section.templateSection.isToggleDependent
        },
        assessedBy: item.section.assessedBy
          ? {
              id: item.section.assessedBy.id,
              firstName: item.section.assessedBy.firstName,
              lastName: item.section.assessedBy.lastName,
              eid: item.section.assessedBy.eid
            }
          : null
      }

      // Add role-specific fields
      if (
        (userMainRole === 'TRAINER' ||
          userMainRole === 'TRAINEE' ||
          userMainRole === 'DEPARTMENT_HEAD' ||
          userMainRole === 'DEPARTMENT HEAD') &&
        canAssessed !== undefined
      ) {
        return {
          roleRequirement: item.roleRequirement,
          ...baseSection,
          canAssessed: canAssessed
        }
      }

      return baseSection
    })

    // const sectionsCanAssess = sectionsWithPermissions.length

    // Base response
    const baseResponse = {
      success: true,
      message: 'Assessment sections retrieved successfully',
      assessmentInfo: {
        id: assessment.id,
        name: assessment.name,
        trainee: {
          id: assessment.trainee.id,
          fullName: `${assessment.trainee.lastName} ${assessment.trainee.middleName || ''} ${assessment.trainee.firstName}`.trim(),
          eid: assessment.trainee.eid,
          traineeProfile: assessment.trainee.traineeProfile
        },
        template: {
          id: assessment.template.id,
          name: assessment.template.name,
          templateContent: assessment.template.templateContent
        },
        subject: assessment.subject
          ? {
              id: assessment.subject.id,
              name: assessment.subject.name,
              code: assessment.subject.code
            }
          : null,
        course: assessment.course
          ? {
              id: assessment.course.id,
              name: assessment.course.name,
              code: assessment.course.code
            }
          : null,
        occuranceDate: assessment.occuranceDate,
        status: assessment.status
      },
      availableTrainers,
      sections: sectionsWithPermissions,
      userRole: userRoleInAssessment || userMainRole,
      isTraineeLocked: assessment.isTraineeLocked
    }

    // Return response with isTraineeLocked for all users
    return baseResponse
  }

  /**
   * Get TRAINEE sections of an assessment form (for viewing trainee sections by trainers/supervisors)
   * This API allows users with course/subject access to view trainee sections without role restrictions
   */
  async getTraineeSections(assessmentId: string, userId: string) {
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
            lastName: true,
            middleName: true,
            traineeProfile: {
              select: {
                userId: true,
                dob: true,
                enrollmentDate: true,
                trainingBatch: true,
                passportNo: true,
                nation: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                deletedById: true
              }
            }
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

    // Verify user has access to this assessment (course/subject scope)
    let hasAccess = false

    if (assessment.subjectId) {
      // Check if user is instructor for this subject
      const subjectInstructor = await this.prisma.subjectInstructor.findFirst({
        where: {
          subjectId: assessment.subjectId,
          trainerUserId: userId
        }
      })
      hasAccess = !!subjectInstructor
    } else if (assessment.courseId) {
      // Check if user is instructor for this course
      const courseInstructor = await this.prisma.courseInstructor.findFirst({
        where: {
          courseId: assessment.courseId,
          trainerUserId: userId
        }
      })
      hasAccess = !!courseInstructor
    }

    if (!hasAccess) {
      throw new Error('You do not have permission to access this assessment')
    }

    // Get user's role in the course/subject for response
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

    // Filter only TRAINEE sections
    const traineeSections = assessment.sections
      .filter((section) => section.templateSection.editBy === 'TRAINEE')
      .map((section, index) => ({
        id: section.id,
        assessmentFormId: section.assessmentFormId,
        assessedById: section.assessedById,
        status: section.status,
        createdAt: section.createdAt,
        templateSection: {
          id: section.templateSection.id,
          label: section.templateSection.label,
          displayOrder: index + 1, // Sequential order for trainee sections
          editBy: section.templateSection.editBy,
          roleInSubject: section.templateSection.roleInSubject,
          isSubmittable: section.templateSection.isSubmittable,
          isToggleDependent: section.templateSection.isToggleDependent
        },
        assessedBy: section.assessedBy
          ? {
              id: section.assessedBy.id,
              firstName: section.assessedBy.firstName,
              lastName: section.assessedBy.lastName,
              eid: section.assessedBy.eid
            }
          : null
      }))

    return {
      success: true,
      message: 'Trainee sections retrieved successfully',
      assessmentInfo: {
        id: assessment.id,
        name: assessment.name,
        trainee: {
          id: assessment.trainee.id,
          firstName: assessment.trainee.firstName,
          lastName: assessment.trainee.lastName,
          eid: assessment.trainee.eid,
          middleName: assessment.trainee.middleName,
          traineeProfile: assessment.trainee.traineeProfile
        },
        template: {
          id: assessment.template.id,
          name: assessment.template.name
        },
        subject: assessment.subject
          ? {
              id: assessment.subject.id,
              name: assessment.subject.name,
              code: assessment.subject.code
            }
          : null,
        course: assessment.course
          ? {
              id: assessment.course.id,
              name: assessment.course.name,
              code: assessment.course.code
            }
          : null,
        occuranceDate: assessment.occuranceDate,
        status: assessment.status,
        isTraineeLocked: assessment.isTraineeLocked
      },
      sections: traineeSections,
      totalTraineeSections: traineeSections.length,
      userRole: userRoleInAssessment || userMainRole
    }
  }

  /**
   * Get all fields of an assessment section with their template field information and assessment values
   */
  async getAssessmentSectionFields(assessmentSectionId: string, userId?: string) {
    // First, get the assessment section with template section info and assessment form data
    const assessmentSection = await this.prisma.assessmentSection.findUnique({
      where: { id: assessmentSectionId },
      include: {
        assessmentForm: {
          include: {
            trainee: {
              select: {
                id: true,
                eid: true,
                firstName: true,
                middleName: true,
                lastName: true,
                traineeProfile: {
                  select: {
                    userId: true,
                    dob: true,
                    enrollmentDate: true,
                    trainingBatch: true,
                    passportNo: true,
                    nation: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                    deletedById: true
                  }
                }
              }
            },
            template: {
              select: {
                id: true,
                name: true,
                templateContent: true
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
                code: true,
                venue: true
              }
            }
          }
        },
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
        },
        assessedBy: {
          select: {
            id: true,
            eid: true,
            firstName: true,
            middleName: true,
            lastName: true
          }
        }
      }
    })

    if (!assessmentSection) {
      throw new Error('Assessment section not found')
    }

    // Get current user information if userId is provided
    let currentUser = null
    if (userId) {
      currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          eid: true,
          firstName: true,
          middleName: true,
          lastName: true,
          signatureImageUrl: true
        }
      })
    }

    // Helper function to map system fields to actual values
    const getSystemFieldValue = (fieldName: string): string | null => {
      const assessment = assessmentSection.assessmentForm

      switch (fieldName) {
        case 'trainee_passport_no':
          return assessment.trainee.traineeProfile?.passportNo || null
          
        case 'trainee_name':
          return `${assessment.trainee.lastName} ${assessment.trainee.middleName || ''} ${assessment.trainee.firstName}`.trim()

        case 'trainee_eid':
          return assessment.trainee.eid

        case 'trainee_nationality':
          return assessment.trainee.traineeProfile?.nation || null

        case 'training_batch':
          return assessment.trainee.traineeProfile?.trainingBatch || null

        case 'course_name':
          return assessment.course?.name || null

        case 'course_code':
          return assessment.course?.code || null

        case 'subject_name':
          return assessment.subject?.name || null

        case 'subject_code':
          return assessment.subject?.code || null

        case 'assessment_date':
          return new Date().toISOString().split('T')[0] // Current date in YYYY-MM-DD format

        case 'assessment_venue':
          return assessment.course?.venue || null

        case 'trainer_name':
        case 'instructor_name': // Alternative field name for trainer
          // Priority: 1) Current user if provided, 2) Assessor if section is assessed
          if (currentUser) {
            return `${currentUser.firstName} ${currentUser.middleName || ''} ${currentUser.lastName}`.trim()
          } else if (assessmentSection.assessedBy) {
            return `${assessmentSection.assessedBy.firstName} ${assessmentSection.assessedBy.middleName || ''} ${assessmentSection.assessedBy.lastName}`.trim()
          }
          return null

        case 'trainer_eid':
        case 'instructor_eid': // Alternative field name for trainer eid
          // Priority: 1) Current user if provided, 2) Assessor if section is assessed
          if (currentUser) {
            return currentUser.eid
          } else if (assessmentSection.assessedBy) {
            return assessmentSection.assessedBy.eid
          }
          return null

        case 'template_name':
          return assessment.template.name

        case 'course_type':
          return assessment.course?.name || null // Using course name as course type

        case 'course_number':
          return assessment.course?.code || null // Using course code as course number

        default:
          return null
      }
    }

    // Create a map of assessment values by template field ID for quick lookup
    const assessmentValueMap = new Map<string, { id: string; answerValue: string | null }>()
    assessmentSection.values.forEach((value) => {
      assessmentValueMap.set(value.templateFieldId, {
        id: value.id,
        answerValue: value.answerValue
      })
    })

    // Handle FINAL_SCORE_NUM and FINAL_SCORE_TEXT logic
    // Check what types of final score fields exist in current section
    const currentSectionFinalScoreNum = assessmentSection.templateSection.fields.find(
      (f) => f.fieldType === 'FINAL_SCORE_NUM'
    )
    const currentSectionFinalScoreText = assessmentSection.templateSection.fields.find(
      (f) => f.fieldType === 'FINAL_SCORE_TEXT'
    )

    let shouldHideFinalScoreText = false

    // Case 2: If current section has only FINAL_SCORE_TEXT, check if any other section has FINAL_SCORE_NUM
    if (!currentSectionFinalScoreNum && currentSectionFinalScoreText) {
      // Get all template sections in this assessment template and check their fields
      const allTemplateSections = await this.prisma.templateSection.findMany({
        where: {
          templateId: assessmentSection.assessmentForm.template.id
        },
        include: {
          fields: {
            where: {
              fieldType: 'FINAL_SCORE_NUM'
            },
            select: {
              id: true
            }
          }
        }
      })

      // Check if any section has FINAL_SCORE_NUM fields
      const hasFinalScoreNum = allTemplateSections.some((section) => section.fields.length > 0)

      // If any section has FINAL_SCORE_NUM, hide FINAL_SCORE_TEXT from current section
      if (hasFinalScoreNum) {
        shouldHideFinalScoreText = true
      }
    }

    // Case 3: If current section has both, hide FINAL_SCORE_TEXT (only show FINAL_SCORE_NUM)
    if (currentSectionFinalScoreNum && currentSectionFinalScoreText) {
      shouldHideFinalScoreText = true
    }

    // Map template fields with their corresponding assessment values
    const fieldsWithValues = assessmentSection.templateSection.fields
      .filter((templateField) => {
        // Filter out FINAL_SCORE_TEXT based on the logic above
        if (templateField.fieldType === 'FINAL_SCORE_TEXT' && shouldHideFinalScoreText) {
          return false
        }

        // Filter out SIGNATURE_DRAW fields for TRAINEE sections (signature handling is in separate screen)
        if (assessmentSection.templateSection.editBy === 'TRAINEE' && templateField.fieldType === 'SIGNATURE_DRAW') {
          return false
        }

        return true
      })
      .map((templateField, index) => {
        const existingValue = assessmentValueMap.get(templateField.id)

        // Check if this is a system field and auto-populate if no value exists
        let finalAnswerValue = existingValue?.answerValue
        if (!finalAnswerValue) {
          // Check for SIGNATURE_IMG field type and auto-populate with user's signatureImageUrl
          if (templateField.fieldType === 'SIGNATURE_IMG' && currentUser?.signatureImageUrl) {
            finalAnswerValue = currentUser.signatureImageUrl
          } else if (templateField.fieldType === 'SIGNATURE_DRAW') {
            // For SIGNATURE_DRAW, if value is null, fallback to assessor's full name
            if (currentUser) {
              finalAnswerValue =
                `${currentUser.firstName} ${currentUser.middleName || ''} ${currentUser.lastName}`.trim()
            } else if (assessmentSection.assessedBy) {
              finalAnswerValue =
                `${assessmentSection.assessedBy.firstName} ${assessmentSection.assessedBy.middleName || ''} ${assessmentSection.assessedBy.lastName}`.trim()
            }
          } else {
            const systemValue = getSystemFieldValue(templateField.fieldName)
            if (systemValue) {
              finalAnswerValue = systemValue
            }
          }
        }

        return {
          templateField: {
            id: templateField.id,
            label: templateField.label,
            fieldName: templateField.fieldName,
            fieldType: templateField.fieldType,
            roleRequired: templateField.roleRequired,
            options: templateField.options,
            displayOrder: index + 1, // Reassign sequential display order after filtering
            parentId: templateField.parentId
          },
          assessmentValue: {
            id: existingValue?.id || '',
            answerValue: finalAnswerValue
          }
        }
      })

    // Get current user's role and assessment permissions
    let userRoleInAssessment: string | null = null
    let userMainRole: string = 'UNKNOWN'

    if (userId) {
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
      userMainRole = user?.role.name || 'UNKNOWN'

      // Get user's role in the course/subject
      if (assessmentSection.assessmentForm.subjectId) {
        const subjectInstructor = await this.prisma.subjectInstructor.findFirst({
          where: {
            subjectId: assessmentSection.assessmentForm.subjectId,
            trainerUserId: userId
          },
          select: {
            roleInAssessment: true
          }
        })
        userRoleInAssessment = subjectInstructor?.roleInAssessment || null
      } else if (assessmentSection.assessmentForm.courseId) {
        const courseInstructor = await this.prisma.courseInstructor.findFirst({
          where: {
            courseId: assessmentSection.assessmentForm.courseId,
            trainerUserId: userId
          },
          select: {
            roleInAssessment: true
          }
        })
        userRoleInAssessment = courseInstructor?.roleInAssessment || null
      }
    }

    // Determine if current user can assess this section type
    let canAssessSection = false
    if (assessmentSection.templateSection.editBy === 'TRAINEE') {
      canAssessSection = userMainRole === 'TRAINEE' && assessmentSection.assessmentForm.traineeId === userId
    } else if (assessmentSection.templateSection.editBy === 'TRAINER') {
      if (userMainRole === 'TRAINER') {
        if (assessmentSection.templateSection.roleInSubject) {
          // ASSESSMENT_REVIEWER can only assess/edit sections that specifically require ASSESSMENT_REVIEWER role
          // They can VIEW all sections, but canSave/canUpdate only for matching role sections
          if (userRoleInAssessment === 'ASSESSMENT_REVIEWER') {
            canAssessSection = assessmentSection.templateSection.roleInSubject === 'ASSESSMENT_REVIEWER'
          } else {
            canAssessSection = userRoleInAssessment === assessmentSection.templateSection.roleInSubject
          }
        } else {
          canAssessSection = userRoleInAssessment !== null
        }
      }
    }

    // Check if assessment form allows updates (business rule)
    // Include NOT_STARTED and ON_GOING to allow initial assessment creation and ongoing work
    const allowedStatusesForUpdates = ['DRAFT', 'SIGNATURE_PENDING', 'READY_TO_SUBMIT', 'REJECTED']
    const assessmentFormAllowsUpdates = allowedStatusesForUpdates.includes(assessmentSection.assessmentForm.status)

    // Determine if current user can update this section
    // canUpdated: false by default, true if section was assessed by current user AND user can assess this section type AND assessment form allows updates
    // DEPARTMENT_HEAD always has canUpdated = false
    let canUpdated = false
    if (userMainRole !== 'DEPARTMENT HEAD' && assessmentFormAllowsUpdates) {
      canUpdated =
        canAssessSection && assessmentSection.assessedById !== null && assessmentSection.assessedById === userId
    }

    // Determine if current user can save this section
    // canSave: false by default, true if section hasn't been assessed yet AND user can assess this section type
    // DEPARTMENT_HEAD always has canSave = false
    let canSave = false
    if (userMainRole !== 'DEPARTMENT HEAD') {
      canSave = canAssessSection && assessmentSection.assessedById === null
    }

    return {
      success: true,
      message: 'Assessment section fields retrieved successfully',
      assessmentSectionInfo: {
        id: assessmentSection.id,
        assessmentFormId: assessmentSection.assessmentFormId,
        templateSectionId: assessmentSection.templateSectionId,
        status: assessmentSection.status,
        canSave: canSave,
        canUpdated: canUpdated,
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
      traineeInfo: {
        id: assessmentSection.assessmentForm.trainee.id,
        firstName: assessmentSection.assessmentForm.trainee.firstName,
        lastName: assessmentSection.assessmentForm.trainee.lastName,
        eid: assessmentSection.assessmentForm.trainee.eid,
        middleName: assessmentSection.assessmentForm.trainee.middleName,
        traineeProfile: assessmentSection.assessmentForm.trainee.traineeProfile
      },
      templateContent: assessmentSection.assessmentForm.template.templateContent,
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
      // First check if section hasn't been assessed yet (safety check with row locking)
      const assessmentSection = await tx.assessmentSection.findUnique({
        where: { id: assessmentSectionId },
        select: {
          assessedById: true,
          createdAt: true
        }
      })

      if (!assessmentSection) {
        throw new Error('Assessment section not found')
      }

      if (assessmentSection.assessedById !== null) {
        throw new Error('This section has already been assessed by another user. Please refresh and try again.')
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
                include: {
                  templateSection: {
                    select: {
                      editBy: true,
                      fields: {
                        select: {
                          fieldType: true,
                          roleRequired: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })

      // Check for TRAINEE sections that contain only a single SIGNATURE_DRAW field
      const traineeSignatureOnlySections = updatedSection.assessmentForm.sections.filter((section) => {
        const isTraineeSection = section.templateSection.editBy === 'TRAINEE'
        if (!isTraineeSection) return false

        const fields = section.templateSection.fields
        const hasOnlySignatureDraw =
          fields.length === 1 && fields[0].fieldType === 'SIGNATURE_DRAW' && fields[0].roleRequired === 'TRAINEE'

        return hasOnlySignatureDraw
      })

      // Get total number of sections in this assessment form
      const totalSections = updatedSection.assessmentForm.sections.length

      // Calculate effective total sections (excluding TRAINEE signature-only sections)
      const effectiveTotalSections = totalSections - traineeSignatureOnlySections.length

      // Check current assessment form status
      let newAssessmentStatus = updatedSection.assessmentForm.status

      // Check how many sections are now DRAFT (including the one just updated)
      const draftSectionsCount = updatedSection.assessmentForm.sections.filter(
        (section) => section.status === AssessmentSectionStatus.DRAFT
      ).length

      if (effectiveTotalSections === 1) {
        // Single effective section: ON_GOING → SIGNATURE_PENDING
        if (newAssessmentStatus === AssessmentStatus.ON_GOING) {
          newAssessmentStatus = AssessmentStatus.SIGNATURE_PENDING
        }
      } else if (effectiveTotalSections > 1) {
        // Multiple effective sections
        if (newAssessmentStatus === AssessmentStatus.ON_GOING && draftSectionsCount === 1) {
          // First section completed: ON_GOING → DRAFT
          newAssessmentStatus = AssessmentStatus.DRAFT
        }

        if (newAssessmentStatus === AssessmentStatus.DRAFT && draftSectionsCount === effectiveTotalSections) {
          // All effective sections completed: DRAFT → SIGNATURE_PENDING
          // This happens when all non-signature-only sections are completed
          newAssessmentStatus = AssessmentStatus.SIGNATURE_PENDING
        }

        // Middle sections (not first, not last) don't change Assessment Form status
        // They only change their own section status to DRAFT
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
      // Get assessment with sections
      const assessment = await tx.assessmentForm.findUnique({
        where: { id: assessmentId },
        include: {
          sections: {
            select: {
              id: true,
              assessedById: true,
              status: true
            }
          }
        }
      })

      if (!assessment) {
        throw new Error('Assessment not found')
      }

      // Check if assessment status allows trainee lock toggle (only ON_GOING and DRAFT)
      const allowedStatuses = [AssessmentStatus.ON_GOING, AssessmentStatus.DRAFT] as const
      if (!allowedStatuses.includes(assessment.status as any)) {
        throw new Error('Can only toggle trainee lock when assessment status is ON_GOING or DRAFT')
      }

      // Check if today is the occurrence date
      const today = new Date()
      const occurrenceDate = new Date(assessment.occuranceDate)
      const isSameDate = today.toDateString() === occurrenceDate.toDateString()

      if (!isSameDate) {
        throw new Error('Can only toggle trainee lock on the occurrence date')
      }

      // Check if the user has assessed any section in this assessment form
      const userAssessedSections = assessment.sections.filter((section) => section.assessedById === userId)

      if (userAssessedSections.length === 0) {
        throw new Error('You can only toggle trainee lock for assessments where you have assessed at least one section')
      }

      // Update assessment form (only toggle isTraineeLocked, no status change)
      const updatedAssessment = await tx.assessmentForm.update({
        where: { id: assessmentId },
        data: {
          isTraineeLocked
        }
      })

      return {
        success: true,
        message: `Trainee lock ${isTraineeLocked ? 'enabled' : 'disabled'} successfully`,
        assessmentFormId: assessmentId,
        isTraineeLocked: isTraineeLocked,
        status: assessment.status, // Status remains unchanged
        assessedSectionsCount: userAssessedSections.length
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
      const allSectionsDraft = assessment.sections.every((section) => section.status === AssessmentSectionStatus.DRAFT)

      if (!allSectionsDraft) {
        throw new Error('All sections must be completed before submission')
      }

      // Check if user filled any submittable sections
      const submittableSections = assessment.sections.filter((section) => section.templateSection.isSubmittable)

      const userFilledSubmittableSection = submittableSections.some((section) => section.assessedById === userId)

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
      // First check if the user is the one who assessed this section and get assessment form info
      const assessmentSection = await tx.assessmentSection.findUnique({
        where: { id: assessmentSectionId },
        select: {
          assessedById: true,
          status: true,
          assessmentForm: {
            select: {
              id: true,
              status: true
            }
          }
        }
      })

      if (!assessmentSection) {
        throw AssessmentSectionNotFoundError
      }

      if (assessmentSection.assessedById !== userId) {
        throw OriginalAssessorOnlyError
      }

      if (assessmentSection.status !== AssessmentSectionStatus.DRAFT) {
        throw SectionDraftStatusOnlyError
      }

      // Check if assessment form allows updates (DRAFT, SIGNATURE_PENDING, READY_TO_SUBMIT, or REJECTED)
      const allowedStatuses = [
        AssessmentStatus.DRAFT,
        AssessmentStatus.SIGNATURE_PENDING,
        AssessmentStatus.READY_TO_SUBMIT,
        AssessmentStatus.REJECTED
      ] as const

      if (!allowedStatuses.includes(assessmentSection.assessmentForm.status as any)) {
        throw AssessmentStatusNotAllowedError
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

      let assessmentFormStatus = assessmentSection.assessmentForm.status

      // If assessment was REJECTED, change it back to READY_TO_SUBMIT after updating any section
      if (assessmentSection.assessmentForm.status === AssessmentStatus.REJECTED) {
        await tx.assessmentForm.update({
          where: { id: assessmentSection.assessmentForm.id },
          data: {
            status: AssessmentStatus.READY_TO_SUBMIT,
            updatedAt: new Date()
          }
        })
        assessmentFormStatus = AssessmentStatus.READY_TO_SUBMIT
      }

      return {
        success: true,
        message:
          assessmentSection.assessmentForm.status === AssessmentStatus.REJECTED
            ? ASSESSMENT_MESSAGES.ASSESSMENT_VALUES_UPDATED_WITH_STATUS_CHANGE
            : ASSESSMENT_MESSAGES.ASSESSMENT_VALUES_UPDATED,
        assessmentSectionId: assessmentSectionId,
        updatedValues: updatedCount,
        sectionStatus: assessmentSection.status,
        assessmentFormStatus: assessmentFormStatus
      }
    })
  }

  /**
   * Confirm assessment participation - Save trainee signature and change status from SIGNATURE_PENDING to READY_TO_SUBMIT
   * Also update section status to DRAFT and set assessedById for TRAINEE signature sections
   */
  async confirmAssessmentParticipation(assessmentId: string, traineeSignatureUrl: string, userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      // Get assessment form with all sections and their current status
      const assessmentForm = await tx.assessmentForm.findUnique({
        where: { id: assessmentId },
        include: {
          sections: {
            include: {
              templateSection: {
                include: {
                  fields: {
                    select: {
                      id: true,
                      fieldType: true,
                      roleRequired: true
                    }
                  }
                }
              },
              values: true
            }
          }
        }
      })

      if (!assessmentForm) {
        throw new Error('Assessment not found')
      }

      let signatureSaved = false
      const updatedSectionIds: string[] = []

      // Find and update the TRAINEE SIGNATURE_DRAW field value AND section status
      for (const section of assessmentForm.sections) {
        // Check if this is a TRAINEE section with SIGNATURE_DRAW field
        const hasTraineeSignatureField = section.templateSection.fields.some(
          (field) => field.fieldType === 'SIGNATURE_DRAW' && field.roleRequired === 'TRAINEE'
        )

        if (hasTraineeSignatureField) {
          // Update signature value
          for (const templateField of section.templateSection.fields) {
            if (templateField.fieldType === 'SIGNATURE_DRAW' && templateField.roleRequired === 'TRAINEE') {
              // Find the corresponding assessment value
              const assessmentValue = section.values.find((value) => value.templateFieldId === templateField.id)

              if (assessmentValue) {
                // Update the signature URL
                await tx.assessmentValue.update({
                  where: { id: assessmentValue.id },
                  data: { answerValue: traineeSignatureUrl }
                })
                signatureSaved = true
              }
            }
          }

          // Always update section to ensure it's marked as DRAFT with proper assessedById
          // This handles both cases:
          // 1. Section with only signature (needs status update)
          // 2. Section with other fields already filled (signature completion)
          const needsUpdate = section.status !== AssessmentSectionStatus.DRAFT || section.assessedById !== userId

          if (needsUpdate) {
            await tx.assessmentSection.update({
              where: { id: section.id },
              data: {
                status: AssessmentSectionStatus.DRAFT,
                assessedById: userId
              }
            })
          }

          // Track this section as processed (regardless of whether DB update was needed)
          updatedSectionIds.push(section.id)
        }
      }

      // Update assessment form status from SIGNATURE_PENDING to READY_TO_SUBMIT
      const updatedAssessment = await tx.assessmentForm.update({
        where: {
          id: assessmentId,
          status: AssessmentStatus.SIGNATURE_PENDING
        },
        data: {
          status: AssessmentStatus.READY_TO_SUBMIT,
          updatedAt: new Date()
        }
      })

      return {
        ...updatedAssessment,
        signatureSaved,
        updatedSectionIds
      }
    })
  }

  /**
   * Check if user has access to an assessment based on department
   */
  async checkUserAssessmentAccess(assessmentId: string, userId: string, departmentId: string): Promise<boolean> {
    const assessment = await this.prisma.assessmentForm.findUnique({
      where: { id: assessmentId },
      select: {
        template: {
          select: {
            departmentId: true
          }
        }
      }
    })

    if (!assessment) return false

    // Check if the assessment's template belongs to the user's department
    return assessment.template.departmentId === departmentId
  }

  /**
   * Get all trainers who assessed sections in an assessment
   * Returns trainers with their email information for rejection notifications
   */
  async getTrainerAssessors(assessmentId: string) {
    // Get all assessment sections with their assessors and template section info
    const assessmentSections = await this.prisma.assessmentSection.findMany({
      where: {
        assessmentFormId: assessmentId,
        assessedById: { not: null }, // Only sections that have been assessed
        templateSection: {
          editBy: 'TRAINER' // Only TRAINER sections
        }
      },
      include: {
        assessedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            middleName: true
          }
        },
        templateSection: {
          select: {
            id: true,
            editBy: true,
            label: true
          }
        }
      }
    })

    // Extract unique trainers (remove duplicates if a trainer assessed multiple sections)
    const uniqueTrainers = assessmentSections
      .filter((section) => section.assessedBy) // Extra safety check
      .reduce(
        (trainers, section) => {
          const trainer = section.assessedBy!
          const existingTrainer = trainers.find((t) => t.id === trainer.id)

          if (!existingTrainer) {
            trainers.push({
              id: trainer.id,
              email: trainer.email,
              firstName: trainer.firstName,
              lastName: trainer.lastName,
              middleName: trainer.middleName,
              fullName: `${trainer.firstName} ${trainer.middleName || ''} ${trainer.lastName}`.trim()
            })
          }

          return trainers
        },
        [] as Array<{
          id: string
          email: string
          firstName: string
          lastName: string
          middleName: string | null
          fullName: string
        }>
      )

    return uniqueTrainers
  }

  /**
   * Get assessment with detailed information for email notifications
   */
  async getAssessmentWithDetails(assessmentId: string) {
    return await this.prisma.assessmentForm.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        name: true,
        submittedAt: true,
        trainee: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        },
        template: {
          select: {
            name: true
          }
        },
        subject: {
          select: {
            name: true
          }
        },
        course: {
          select: {
            name: true
          }
        }
      }
    })
  }

  /**
   * Approve or reject a SUBMITTED assessment form
   */
  async approveRejectAssessment(
    assessmentId: string,
    action: 'APPROVED' | 'REJECTED',
    comment: string | undefined,
    approvedById: string
  ) {
    const now = new Date()

    return await this.prisma.$transaction(async (tx) => {
      // Get assessment with template and related course/subject data
      const assessment = await tx.assessmentForm.findUnique({
        where: { id: assessmentId },
        include: {
          template: {
            select: { id: true }
          },
          course: {
            select: {
              id: true,
              passScore: true
            }
          },
          subject: {
            select: {
              id: true,
              passScore: true
            }
          },
          sections: {
            include: {
              values: {
                include: {
                  templateField: {
                    select: {
                      id: true,
                      fieldType: true
                    }
                  }
                }
              },
              assessedBy: {
                select: {
                  id: true,
                  signatureImageUrl: true,
                  lastName: true
                }
              }
            }
          }
        }
      })

      if (!assessment) {
        throw new Error('Assessment not found')
      }

      let resultScore: number | null = null
      let resultText: AssessmentResult = AssessmentResult.NOT_APPLICABLE

      // Only process final scores and signatures for APPROVED assessments
      if (action === 'APPROVED') {
        // Process SIGNATURE_IMG fields first
        for (const section of assessment.sections) {
          for (const value of section.values) {
            if (value.templateField.fieldType === 'SIGNATURE_IMG') {
              // Find the user who assessed this section
              const sectionWithAssessor = await tx.assessmentSection.findUnique({
                where: { id: section.id },
                include: {
                  assessedBy: {
                    select: {
                      id: true,
                      signatureImageUrl: true,
                      lastName: true,
                      middleName: true,
                      firstName: true
                    }
                  }
                }
              })

              if (sectionWithAssessor?.assessedBy) {
                const assessor = sectionWithAssessor.assessedBy
                let signatureValue: string

                if (assessor.signatureImageUrl) {
                  // Use signature image URL if available
                  signatureValue = assessor.signatureImageUrl
                } else {
                  // Use full name as fallback if no signature image
                  signatureValue = assessor.firstName + ' ' + assessor.middleName + ' ' + assessor.lastName
                }

                // Update the SIGNATURE_IMG field value
                await tx.assessmentValue.updateMany({
                  where: {
                    id: value.id
                  },
                  data: {
                    answerValue: signatureValue
                  }
                })
              }
            }
          }
        }

        // Get pass score from course or subject
        let passScore: number | null = null
        if (assessment.courseId && assessment.subjectId === null) {
          // Course scope
          passScore = assessment.course?.passScore || null
        } else if (assessment.subjectId) {
          // Subject scope
          passScore = assessment.subject?.passScore || null
        }

        // Find FINAL_SCORE_NUM and FINAL_SCORE_TEXT values across all sections
        let finalScoreNumValue: number | null = null
        let finalScoreTextFieldId: string | null = null

        for (const section of assessment.sections) {
          for (const value of section.values) {
            if (value.templateField.fieldType === 'FINAL_SCORE_NUM' && value.answerValue) {
              const numValue = parseFloat(value.answerValue)
              if (!isNaN(numValue)) {
                finalScoreNumValue = numValue
              }
            } else if (value.templateField.fieldType === 'FINAL_SCORE_TEXT') {
              finalScoreTextFieldId = value.templateField.id
            }
          }
        }

        // Logic for setting resultScore and resultText
        if (finalScoreNumValue !== null) {
          // Case 1: Has FINAL_SCORE_NUM
          resultScore = finalScoreNumValue

          // If there's also a FINAL_SCORE_TEXT field, auto-fill it based on pass/fail logic
          if (finalScoreTextFieldId && passScore !== null) {
            const isPass = finalScoreNumValue >= passScore
            resultText = isPass ? AssessmentResult.PASS : AssessmentResult.FAIL

            // Update the FINAL_SCORE_TEXT field in the database
            await tx.assessmentValue.updateMany({
              where: {
                templateFieldId: finalScoreTextFieldId,
                assessmentSection: {
                  assessmentFormId: assessmentId
                }
              },
              data: {
                answerValue: resultText
              }
            })
          } else {
            // No FINAL_SCORE_TEXT field or no passScore
            resultText = AssessmentResult.NOT_APPLICABLE
          }
        } else {
          // Case 2: Only FINAL_SCORE_TEXT (no FINAL_SCORE_NUM)
          resultScore = null

          // Find the FINAL_SCORE_TEXT value
          for (const section of assessment.sections) {
            for (const value of section.values) {
              if (value.templateField.fieldType === 'FINAL_SCORE_TEXT' && value.answerValue) {
                const textValue = value.answerValue.toUpperCase()
                if (textValue === 'PASS') {
                  resultText = AssessmentResult.PASS
                } else if (textValue === 'FAIL') {
                  resultText = AssessmentResult.FAIL
                } else if (textValue === 'NOT_APPLICABLE') {
                  resultText = AssessmentResult.NOT_APPLICABLE
                }
                break
              }
            }
          }
        }
      }

      // Update assessment form
      return await tx.assessmentForm.update({
        where: {
          id: assessmentId,
          status: AssessmentStatus.SUBMITTED
        },
        data: {
          status: action === 'APPROVED' ? AssessmentStatus.APPROVED : AssessmentStatus.REJECTED,
          comment: comment || null,
          approvedById: action === 'APPROVED' ? approvedById : null,
          approvedAt: action === 'APPROVED' ? now : null,
          resultScore: action === 'APPROVED' ? resultScore : null,
          resultText: action === 'APPROVED' ? resultText : null,
          updatedAt: now
        }
      })
    })
  }

  /**
   * Get assessment events - grouped assessment forms by subject/course, occurrence date, and template (excluding name due to EID suffix)
   */
  async getAssessmentEvents(
    page: number = 1,
    limit: number = 1000,
    status?: z.infer<typeof AssessmentEventStatus>,
    subjectId?: string,
    courseId?: string,
    templateId?: string,
    fromDate?: Date,
    toDate?: Date,
    search?: string
  ) {
    // Build where conditions (ignore status parameter to avoid duplicates - status will be calculated)
    const whereConditions: any = {}

    if (subjectId) {
      whereConditions.subjectId = subjectId
    }

    if (courseId) {
      whereConditions.courseId = courseId
    }

    if (templateId) {
      whereConditions.templateId = templateId
    }

    if (fromDate || toDate) {
      whereConditions.occuranceDate = {}
      if (fromDate) {
        whereConditions.occuranceDate.gte = fromDate
      }
      if (toDate) {
        whereConditions.occuranceDate.lte = toDate
      }
    }

    if (search) {
      // Search by extracting base name (removing EID pattern) from assessment names
      whereConditions.name = {
        contains: search,
        mode: 'insensitive'
      }
    }

    // Get ALL grouped assessment forms first (without pagination to properly calculate status)
    // Exclude 'name' from groupBy since each assessment now has unique name with trainee EID
    const allEvents = await this.prisma.assessmentForm.groupBy({
      by: ['subjectId', 'courseId', 'occuranceDate', 'templateId'],
      where: whereConditions,
      _count: {
        id: true
      },
      orderBy: {
        occuranceDate: 'desc'
      }
    })

    // Enrich ALL events with subject/course and template information and calculate status
    const allEnrichedEvents = await Promise.all(
      allEvents.map(async (event) => {
        let entityInfo: { id: string; name: string; code: string; type: 'subject' | 'course'; belongToCourseName: string | null } | null = null

        // Get subject or course info
        if (event.subjectId) {
          const subject = await this.prisma.subject.findUnique({
            where: { id: event.subjectId },
            select: { 
              id: true, 
              name: true, 
              code: true,
              course: {
                select: {
                  name: true
                }
              }
            }
          })
          if (subject) {
            entityInfo = {
              id: subject.id,
              name: subject.name,
              code: subject.code,
              type: 'subject',
              belongToCourseName: subject.course.name
            }
          }
        } else if (event.courseId) {
          const course = await this.prisma.course.findUnique({
            where: { id: event.courseId },
            select: { id: true, name: true, code: true }
          })
          if (course) {
            entityInfo = {
              id: course.id,
              name: course.name,
              code: course.code,
              type: 'course',
              belongToCourseName: null
            }
          }
        }

        // Get template info
        const template = await this.prisma.templateForm.findUnique({
          where: { id: event.templateId },
          select: { id: true, name: true, status: true }
        })

        // Calculate status based on all assessments in the event
        let eventStatus: 'NOT_STARTED' | 'ON_GOING' | 'FINISHED'

        // Get all assessments for this event with trainee information
        const allAssessments = await this.prisma.assessmentForm.findMany({
          where: {
            subjectId: event.subjectId,
            courseId: event.courseId,
            occuranceDate: event.occuranceDate,
            templateId: event.templateId
          },
          select: { 
            id: true,
            status: true, 
            name: true,
            occuranceDate: true,
            resultScore: true,
            resultText: true,
            pdfUrl: true,
            trainee: {
              select: {
                eid: true,
                firstName: true,
                lastName: true,
                middleName: true
              }
            }
          }
        })

        // Extract base name from first assessment (get part before dash)
        const baseName = allAssessments.length > 0 ? allAssessments[0].name.split(' - ')[0] : 'Unknown Event'

        // Build traineeRoster array with assessment details
        const traineeRoster = allAssessments.map((assessment) => ({
          assessmentFormId: assessment.id,
          assessmentFormName: assessment.name,
          traineeFullName: `${assessment.trainee.lastName}${assessment.trainee.middleName ? ' ' + assessment.trainee.middleName : ''} ${assessment.trainee.firstName}`.trim(),
          traineeEid: assessment.trainee.eid,
          occuranceDate: assessment.occuranceDate,
          status: assessment.status,
          resultScore: assessment.resultScore,
          resultText: assessment.resultText,
          pdfUrl: assessment.pdfUrl
        }))

        // Check if all assessments are NOT_STARTED
        const allNotStarted = allAssessments.every((assessment) => assessment.status === 'NOT_STARTED')

        if (allNotStarted) {
          eventStatus = 'NOT_STARTED'
        } else {
          // Check if all assessments are finished (APPROVED or CANCELLED)
          const allFinished = allAssessments.every(
            (assessment) => assessment.status === 'APPROVED' || assessment.status === 'CANCELLED'
          )

          if (allFinished) {
            eventStatus = 'FINISHED'
          } else {
            // If some are started but not all finished, it's ON_GOING
            eventStatus = 'ON_GOING'
          }
        }

        // Calculate totalPassed and totalFailed based on resultText
        const totalPassed = allAssessments.filter((assessment) => assessment.resultText === 'PASS').length
        const totalFailed = allAssessments.filter((assessment) => assessment.resultText === 'FAIL').length

        return {
          name: baseName,
          subjectId: event.subjectId,
          courseId: event.courseId,
          occuranceDate: event.occuranceDate,
          status: eventStatus,
          totalTrainees: event._count.id,
          totalPassed,
          totalFailed,
          entityInfo: entityInfo || {
            id: '',
            name: 'Unknown',
            code: 'UNKNOWN',
            type: event.subjectId ? 'subject' : 'course',
            belongToCourseName: null
          },
          templateInfo: template
            ? {
                id: template.id,
                name: template.name,
                isActive: template.status === 'PUBLISHED'
              }
            : {
                id: event.templateId,
                name: 'Unknown Template',
                isActive: false
              },
          traineeRoster
        }
      })
    )

    // Filter by status after calculating event status (if status filter is provided)
    let filteredEvents = allEnrichedEvents
    if (status) {
      filteredEvents = allEnrichedEvents.filter((event) => event.status === status)
    }

    // Calculate total after filtering
    const total = filteredEvents.length
    const totalPages = Math.ceil(total / limit)

    // Apply pagination to filtered results
    const skip = (page - 1) * limit
    const paginatedEvents = filteredEvents.slice(skip, skip + limit)

    return {
      success: true,
      message: 'Assessment events retrieved successfully',
      data: {
        events: paginatedEvents,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    }
  }

  /**
   * Get department assessment events - grouped assessment forms by department with enhanced statistics
   * Includes both Course and Subject scope with additional statistics: totalAssessments, totalReviewedForm, totalCancelledForm, totalTrainers
   */
  async getDepartmentAssessmentEvents(
    departmentId: string,
    page: number = 1,
    limit: number = 1000,
    status?: z.infer<typeof AssessmentEventStatus>,
    subjectId?: string,
    courseId?: string,
    templateId?: string,
    fromDate?: Date,
    toDate?: Date,
    search?: string
  ): Promise<GetDepartmentAssessmentEventsResType> {
    // Build where conditions for department-specific assessments
    const whereConditions: any = {
      OR: [] // Will be filled with department-related conditions
    }

    // Get department subjects and courses
    const [departmentSubjects, departmentCourses] = await Promise.all([
      this.prisma.subject.findMany({
        where: { 
          course: { 
            departmentId,
            status: { not: 'ARCHIVED' } // Active courses (not archived)
          },
          status: { not: 'ARCHIVED' } // Active subjects (not archived)
        },
        select: { id: true }
      }),
      this.prisma.course.findMany({
        where: { 
          departmentId,
          status: { not: 'ARCHIVED' } // Active courses (not archived)
        },
        select: { id: true }
      })
    ])

    // Add conditions for department subjects and courses
    if (departmentSubjects.length > 0) {
      whereConditions.OR.push({
        subjectId: {
          in: departmentSubjects.map(s => s.id)
        }
      })
    }

    if (departmentCourses.length > 0) {
      whereConditions.OR.push({
        courseId: {
          in: departmentCourses.map(c => c.id)
        }
      })
    }

    // If no subjects or courses found for department, return empty result
    if (whereConditions.OR.length === 0) {
      return {
        success: true,
        message: 'No assessment events found for this department',
        data: {
          events: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      }
    }

    // Apply additional filters
    const additionalConditions: any = {}

    if (subjectId) {
      additionalConditions.subjectId = subjectId
    }

    if (courseId) {
      additionalConditions.courseId = courseId
    }

    if (templateId) {
      additionalConditions.templateId = templateId
    }

    if (fromDate || toDate) {
      additionalConditions.occuranceDate = {}
      if (fromDate) {
        additionalConditions.occuranceDate.gte = fromDate
      }
      if (toDate) {
        additionalConditions.occuranceDate.lte = toDate
      }
    }

    if (search) {
      additionalConditions.name = {
        contains: search,
        mode: 'insensitive'
      }
    }

    // Combine department filter with additional conditions
    const finalWhereConditions = {
      AND: [
        whereConditions, // Department filter (OR conditions for subjects/courses)
        additionalConditions // Additional filters (AND conditions)
      ]
    }

    // Get ALL grouped assessment forms first (without pagination to properly calculate status and statistics)
    const allEvents = await this.prisma.assessmentForm.groupBy({
      by: ['subjectId', 'courseId', 'occuranceDate', 'templateId'],
      where: finalWhereConditions,
      _count: {
        id: true
      },
      orderBy: {
        occuranceDate: 'desc'
      }
    })

    // Enrich ALL events with enhanced statistics and information
    const allEnrichedEvents = await Promise.all(
      allEvents.map(async (event) => {
        let entityInfo: { id: string; name: string; code: string; type: 'subject' | 'course' } | null = null

        // Get subject or course info
        if (event.subjectId) {
          const subject = await this.prisma.subject.findUnique({
            where: { id: event.subjectId },
            select: { id: true, name: true, code: true }
          })
          if (subject) {
            entityInfo = {
              id: subject.id,
              name: subject.name,
              code: subject.code,
              type: 'subject'
            }
          }
        } else if (event.courseId) {
          const course = await this.prisma.course.findUnique({
            where: { id: event.courseId },
            select: { id: true, name: true, code: true }
          })
          if (course) {
            entityInfo = {
              id: course.id,
              name: course.name,
              code: course.code,
              type: 'course'
            }
          }
        }

        // Get template info
        const template = await this.prisma.templateForm.findUnique({
          where: { id: event.templateId },
          select: { id: true, name: true, status: true }
        })

        // Get all assessments for this event with their statuses
        const allAssessments = await this.prisma.assessmentForm.findMany({
          where: {
            subjectId: event.subjectId,
            courseId: event.courseId,
            occuranceDate: event.occuranceDate,
            templateId: event.templateId
          },
          select: { status: true, name: true }
        })

        // Calculate enhanced statistics
        const totalAssessments = allAssessments.length
        const totalReviewedForm = allAssessments.filter(a => 
          a.status === 'APPROVED' || a.status === 'REJECTED'
        ).length
        const totalCancelledForm = allAssessments.filter(a => 
          a.status === 'CANCELLED'
        ).length
        const totalSubmittedForm = allAssessments.filter(a => 
          a.status === 'SUBMITTED'
        ).length

        // Get total trainers from Subject/Course_Instructor tables
        let totalTrainers = 0
        if (event.subjectId) {
          totalTrainers = await this.prisma.subjectInstructor.count({
            where: { subjectId: event.subjectId }
          })
        } else if (event.courseId) {
          totalTrainers = await this.prisma.courseInstructor.count({
            where: { courseId: event.courseId }
          })
        }

        // Extract base name from first assessment (get part before dash)
        const baseName = allAssessments.length > 0 ? allAssessments[0].name.split(' - ')[0] : 'Unknown Event'

        // Calculate event status based on all assessments
        let eventStatus: 'NOT_STARTED' | 'ON_GOING' | 'FINISHED'

        const allNotStarted = allAssessments.every((assessment) => assessment.status === 'NOT_STARTED')

        if (allNotStarted) {
          eventStatus = 'NOT_STARTED'
        } else {
          const allFinished = allAssessments.every(
            (assessment) => assessment.status === 'APPROVED' || assessment.status === 'CANCELLED'
          )

          if (allFinished) {
            eventStatus = 'FINISHED'
          } else {
            eventStatus = 'ON_GOING'
          }
        }

        return {
          name: baseName,
          subjectId: event.subjectId,
          courseId: event.courseId,
          occuranceDate: event.occuranceDate,
          status: eventStatus,
          totalTrainees: event._count.id,
          // Enhanced statistics
          totalAssessments,
          totalReviewedForm,
          totalCancelledForm,
          totalSubmittedForm,
          totalTrainers,
          entityInfo: entityInfo || {
            id: '',
            name: 'Unknown',
            code: 'UNKNOWN',
            type: event.subjectId ? 'subject' : 'course'
          },
          templateInfo: template
            ? {
                id: template.id,
                name: template.name,
                isActive: template.status === 'PUBLISHED'
              }
            : {
                id: event.templateId,
                name: 'Unknown Template',
                isActive: false
              }
        }
      })
    )

    // Filter by status after calculating event status (if status filter is provided)
    let filteredEvents = allEnrichedEvents
    if (status) {
      filteredEvents = allEnrichedEvents.filter((event) => event.status === status)
    }

    // Calculate total after filtering
    const total = filteredEvents.length
    const totalPages = Math.ceil(total / limit)

    // Apply pagination to filtered results
    const skip = (page - 1) * limit
    const paginatedEvents = filteredEvents.slice(skip, skip + limit)

    return {
      success: true,
      message: 'Department assessment events retrieved successfully',
      data: {
        events: paginatedEvents,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    }
  }

  /**
   * Get assessment events for a specific user based on their role (TRAINER/TRAINEE) and assignments
   */
  async getUserAssessmentEvents(
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 1000,
    courseId?: string,
    subjectId?: string,
    search?: string
  ): Promise<GetUserAssessmentEventsResType> {
    // Build OR conditions for assessment forms based on user role
    const orConditions: Array<{
      courseId?: string
      subjectId?: string | null
    }> = []

    if (userRole === 'TRAINER') {
      // Get trainer's course and subject assignments
      const [courseAssignments, subjectAssignments] = await Promise.all([
        this.prisma.courseInstructor.findMany({
          where: {
            trainerUserId: userId,
            ...(courseId ? { courseId } : {})
          },
          select: {
            courseId: true
          }
        }),
        this.prisma.subjectInstructor.findMany({
          where: {
            trainerUserId: userId,
            ...(subjectId ? { subjectId } : {})
          },
          select: {
            subjectId: true
          }
        })
      ])

      // Add course-based conditions (courseId present, subjectId null)
      courseAssignments.forEach((assignment) => {
        orConditions.push({
          courseId: assignment.courseId,
          subjectId: null
        })
      })

      // Add subject-based conditions
      subjectAssignments.forEach((assignment) => {
        orConditions.push({
          subjectId: assignment.subjectId
        })
      })
    } else if (userRole === 'TRAINEE') {
      // Get trainee's subject enrollments
      const subjectEnrollments = await this.prisma.subjectEnrollment.findMany({
        where: {
          traineeUserId: userId,
          ...(subjectId ? { subjectId } : {})
        },
        include: {
          subject: {
            select: {
              id: true,
              courseId: true
            }
          }
        }
      })

      if (courseId) {
        // Filter by course: include subjects that belong to the specified course
        const courseSubjects = subjectEnrollments.filter((enrollment) => enrollment.subject.courseId === courseId)
        courseSubjects.forEach((enrollment) => {
          orConditions.push({
            subjectId: enrollment.subjectId
          })
        })

        // Also include course-level assessments for the specified course
        orConditions.push({
          courseId: courseId,
          subjectId: null
        })
      } else {
        // Add all enrolled subjects
        subjectEnrollments.forEach((enrollment) => {
          orConditions.push({
            subjectId: enrollment.subjectId
          })
        })

        // Add course-level assessments for courses that contain enrolled subjects
        const enrolledCourseIds = [...new Set(subjectEnrollments.map((e) => e.subject.courseId))]
        enrolledCourseIds.forEach((courseId) => {
          orConditions.push({
            courseId: courseId,
            subjectId: null
          })
        })
      }
    }

    if (orConditions.length === 0) {
      return {
        success: true,
        message: `No assessment events found for ${userRole.toLowerCase()}`,
        data: {
          events: [],
          totalItems: 0,
          page,
          limit,
          totalPages: 0
        }
      }
    }

    // Build where conditions for assessment forms
    const whereConditions: any = {
      OR: orConditions
    }

    if (search) {
      whereConditions.name = {
        contains: search,
        mode: 'insensitive'
      }
    }

    // Get ALL grouped assessment forms first (without pagination to properly calculate status)
    // Exclude 'name' from groupBy since each assessment now has unique name with trainee EID
    const allEvents = await this.prisma.assessmentForm.groupBy({
      by: ['subjectId', 'courseId', 'occuranceDate', 'templateId'],
      where: whereConditions,
      _count: {
        id: true
      },
      orderBy: {
        occuranceDate: 'desc'
      }
    })

    // Enrich ALL events with subject/course and template information and calculate status
    const allEnrichedEvents = await Promise.all(
      allEvents.map(async (event) => {
        let entityInfo: { id: string; name: string; code: string; type: 'subject' | 'course'; belongToCourseName: string | null } | null = null

        // Get subject or course info
        if (event.subjectId) {
          const subject = await this.prisma.subject.findUnique({
            where: { id: event.subjectId },
            select: { 
              id: true, 
              name: true, 
              code: true,
              course: {
                select: {
                  name: true
                }
              }
            }
          })
          if (subject) {
            entityInfo = {
              id: subject.id,
              name: subject.name,
              code: subject.code,
              type: 'subject',
              belongToCourseName: subject.course.name
            }
          }
        } else if (event.courseId) {
          const course = await this.prisma.course.findUnique({
            where: { id: event.courseId },
            select: { id: true, name: true, code: true }
          })
          if (course) {
            entityInfo = {
              id: course.id,
              name: course.name,
              code: course.code,
              type: 'course',
              belongToCourseName: null
            }
          }
        }

        // Get template info
        const template = await this.prisma.templateForm.findUnique({
          where: { id: event.templateId },
          select: { id: true, name: true, status: true }
        })

        // Calculate status based on all assessments in the event
        let eventStatus: 'NOT_STARTED' | 'ON_GOING' | 'FINISHED'

        // Get all assessments for this event with trainee information
        const allAssessments = await this.prisma.assessmentForm.findMany({
          where: {
            subjectId: event.subjectId,
            courseId: event.courseId,
            occuranceDate: event.occuranceDate,
            templateId: event.templateId
          },
          select: { 
            id: true,
            status: true, 
            name: true,
            occuranceDate: true,
            resultScore: true,
            resultText: true,
            pdfUrl: true,
            trainee: {
              select: {
                eid: true,
                firstName: true,
                lastName: true,
                middleName: true
              }
            }
          }
        })

        // Extract base name from first assessment (get part before dash)
        const baseName = allAssessments.length > 0 ? allAssessments[0].name.split(' - ')[0] : 'Unknown Event'

        // Build traineeRoster array with assessment details
        const traineeRoster = allAssessments.map((assessment) => ({
          assessmentFormId: assessment.id,
          assessmentFormName: assessment.name,
          traineeFullName: `${assessment.trainee.lastName}${assessment.trainee.middleName ? ' ' + assessment.trainee.middleName : ''} ${assessment.trainee.firstName}`.trim(),
          traineeEid: assessment.trainee.eid,
          occuranceDate: assessment.occuranceDate,
          status: assessment.status,
          resultScore: assessment.resultScore,
          resultText: assessment.resultText,
          pdfUrl: assessment.pdfUrl
        }))

        // Check if all assessments are NOT_STARTED
        const allNotStarted = allAssessments.every((assessment) => assessment.status === 'NOT_STARTED')

        if (allNotStarted) {
          eventStatus = 'NOT_STARTED'
        } else {
          // Check if all assessments are finished (APPROVED or CANCELLED)
          const allFinished = allAssessments.every(
            (assessment) => assessment.status === 'APPROVED' || assessment.status === 'CANCELLED'
          )

          if (allFinished) {
            eventStatus = 'FINISHED'
          } else {
            // If some are started but not all finished, it's ON_GOING
            eventStatus = 'ON_GOING'
          }
        }

        // Calculate totalPassed and totalFailed based on resultText
        const totalPassed = allAssessments.filter((assessment) => assessment.resultText === 'PASS').length
        const totalFailed = allAssessments.filter((assessment) => assessment.resultText === 'FAIL').length

        return {
          name: baseName,
          subjectId: event.subjectId,
          courseId: event.courseId,
          occuranceDate: event.occuranceDate,
          status: eventStatus,
          totalTrainees: event._count.id,
          totalPassed,
          totalFailed,
          entityInfo: entityInfo || {
            id: '',
            name: 'Unknown',
            code: 'UNKNOWN',
            type: event.subjectId ? 'subject' : 'course',
            belongToCourseName: null
          },
          templateInfo: template
            ? {
                id: template.id,
                name: template.name,
                isActive: template.status === 'PUBLISHED'
              }
            : {
                id: event.templateId,
                name: 'Unknown Template',
                isActive: false
              },
          traineeRoster
        }
      })
    )

    // Apply pagination to all enriched events
    const totalItems = allEnrichedEvents.length
    const totalPages = Math.ceil(totalItems / limit)

    // Apply pagination
    const skip = (page - 1) * limit
    const paginatedEvents = allEnrichedEvents.slice(skip, skip + limit)

    return {
      success: true,
      message: 'Assessment events retrieved successfully',
      data: {
        events: paginatedEvents,
        totalItems,
        page,
        limit,
        totalPages
      }
    }
  }

  /**
   * Update assessment event (name and/or occurrence date for all matching assessment forms)
   */
  async updateAssessmentEvent(
    currentName: string,
    subjectId: string | undefined,
    courseId: string | undefined,
    currentOccuranceDate: Date,
    templateId: string,
    updates: {
      name?: string
      occuranceDate?: Date
    }
  ) {
    // Get current date (today)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const currentDateOnly = new Date(currentOccuranceDate)
    currentDateOnly.setHours(0, 0, 0, 0)

    // Find all existing assessments for this event
    const existingAssessments = await this.prisma.assessmentForm.findMany({
      where: {
        name: currentName,
        ...(subjectId ? { subjectId } : { courseId }),
        occuranceDate: currentOccuranceDate,
        templateId: templateId
      },
      select: {
        id: true,
        status: true,
        traineeId: true
      }
    })

    if (existingAssessments.length === 0) {
      throw new Error('No assessment forms found for this event')
    }

    // If only updating name, allow update regardless of date/status
    if (updates.name && !updates.occuranceDate) {
      const result = await this.prisma.assessmentForm.updateMany({
        where: {
          name: currentName,
          ...(subjectId ? { subjectId } : { courseId }),
          occuranceDate: currentOccuranceDate,
          templateId: templateId
        },
        data: { name: updates.name }
      })

      return {
        success: true,
        message: `Successfully updated name for ${result.count} assessment form(s)`,
        data: {
          updatedCount: result.count,
          eventInfo: {
            name: updates.name,
            subjectId: subjectId || null,
            courseId: courseId || null,
            occuranceDate: currentOccuranceDate,
            templateId: templateId,
            totalAssessmentForms: result.count
          }
        }
      }
    }

    // If updating occurrence date, validate the new date
    if (updates.occuranceDate) {
      const newDateOnly = new Date(updates.occuranceDate)
      newDateOnly.setHours(0, 0, 0, 0)

      // Rule 1: Can only update to today or future date
      if (newDateOnly < today) {
        throw new Error('New occurrence date must be today or in the future')
      }

      // Rule 2: If updating from future date to today (NOT_STARTED to ON_GOING)
      if (currentDateOnly > today && newDateOnly.getTime() === today.getTime()) {
        // Check if there's already another assessment event on the same day for same template
        const conflictingAssessment = await this.prisma.assessmentForm.findFirst({
          where: {
            ...(subjectId ? { subjectId } : { courseId }),
            templateId: templateId,
            occuranceDate: {
              gte: today,
              lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Next day
            },
            NOT: {
              name: currentName,
              occuranceDate: currentOccuranceDate
            }
          }
        })

        if (conflictingAssessment) {
          throw new Error(
            'Cannot update to today - there is already another assessment event using this template on the same date'
          )
        }

        // Validate all assessments are in NOT_STARTED status
        const nonNotStartedAssessments = existingAssessments.filter(
          (assessment) => assessment.status !== AssessmentStatus.NOT_STARTED
        )

        if (nonNotStartedAssessments.length > 0) {
          throw new Error('Cannot update to today - some assessments are not in NOT_STARTED status')
        }

        // Update occurrence date and change status to ON_GOING
        const updateData: any = {
          occuranceDate: updates.occuranceDate,
          status: AssessmentStatus.ON_GOING
        }
        if (updates.name) {
          updateData.name = updates.name
        }

        const result = await this.prisma.assessmentForm.updateMany({
          where: {
            name: currentName,
            ...(subjectId ? { subjectId } : { courseId }),
            occuranceDate: currentOccuranceDate,
            templateId: templateId
          },
          data: updateData
        })

        return {
          success: true,
          message: `Successfully updated ${result.count} assessment form(s) and changed status to ON_GOING`,
          data: {
            updatedCount: result.count,
            statusChanged: true,
            newStatus: AssessmentStatus.ON_GOING,
            eventInfo: {
              name: updates.name || currentName,
              subjectId: subjectId || null,
              courseId: courseId || null,
              occuranceDate: updates.occuranceDate,
              templateId: templateId,
              totalAssessmentForms: result.count
            }
          }
        }
      }

      // Rule 3: If updating from today to future date
      if (currentDateOnly.getTime() === today.getTime() && newDateOnly > today) {
        // Check if all assessments are ON_GOING, NOT_STARTED, or other allowed statuses
        const invalidStatusAssessments = existingAssessments.filter(
          (assessment) =>
            assessment.status !== AssessmentStatus.ON_GOING && assessment.status !== AssessmentStatus.NOT_STARTED
        )

        if (invalidStatusAssessments.length > 0) {
          const invalidStatuses = [...new Set(invalidStatusAssessments.map((a) => a.status))].join(', ')
          throw new Error(
            `Cannot update from today to future date - some assessments have status: ${invalidStatuses}. Only ON_GOING and NOT_STARTED assessments can be moved to future date.`
          )
        }

        // Update occurrence date and change status to NOT_STARTED
        const updateData: any = {
          occuranceDate: updates.occuranceDate,
          status: AssessmentStatus.NOT_STARTED
        }
        if (updates.name) {
          updateData.name = updates.name
        }

        const result = await this.prisma.assessmentForm.updateMany({
          where: {
            name: currentName,
            ...(subjectId ? { subjectId } : { courseId }),
            occuranceDate: currentOccuranceDate,
            templateId: templateId
          },
          data: updateData
        })

        return {
          success: true,
          message: `Successfully updated ${result.count} assessment form(s) and changed status to NOT_STARTED`,
          data: {
            updatedCount: result.count,
            statusChanged: true,
            newStatus: AssessmentStatus.NOT_STARTED,
            eventInfo: {
              name: updates.name || currentName,
              subjectId: subjectId || null,
              courseId: courseId || null,
              occuranceDate: updates.occuranceDate,
              templateId: templateId,
              totalAssessmentForms: result.count
            }
          }
        }
      }

      // For other date changes (future to future), only allow if all are NOT_STARTED
      const nonNotStartedAssessments = existingAssessments.filter(
        (assessment) => assessment.status !== AssessmentStatus.NOT_STARTED
      )

      if (nonNotStartedAssessments.length > 0) {
        const invalidStatuses = [...new Set(nonNotStartedAssessments.map((a) => a.status))].join(', ')
        throw new Error(
          `Cannot update occurrence date - some assessments have status: ${invalidStatuses}. Only NOT_STARTED assessments can have their occurrence date changed.`
        )
      }

      // Standard date update for future dates
      const updateData: any = {
        occuranceDate: updates.occuranceDate
      }
      if (updates.name) {
        updateData.name = updates.name
      }

      const result = await this.prisma.assessmentForm.updateMany({
        where: {
          name: currentName,
          ...(subjectId ? { subjectId } : { courseId }),
          occuranceDate: currentOccuranceDate,
          templateId: templateId,
          status: AssessmentStatus.NOT_STARTED
        },
        data: updateData
      })

      return {
        success: true,
        message: `Successfully updated ${result.count} assessment form(s)`,
        data: {
          updatedCount: result.count,
          statusChanged: false,
          eventInfo: {
            name: updates.name || currentName,
            subjectId: subjectId || null,
            courseId: courseId || null,
            occuranceDate: updates.occuranceDate,
            templateId: templateId,
            totalAssessmentForms: result.count
          }
        }
      }
    }

    // Should not reach here, but fallback
    throw new Error('Invalid update operation')
  }

  /**
   * Update assessment status to ON_GOING when occurrence date arrives
   * This should be called by a scheduled job or when the occurrence date is reached
   */
  async updateAssessmentStatusOnOccurrenceDate(
    name: string,
    subjectId: string | undefined,
    courseId: string | undefined,
    occuranceDate: Date,
    templateId: string
  ) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const targetDate = new Date(occuranceDate)
    targetDate.setHours(0, 0, 0, 0)

    // Only update if the occurrence date is today or past
    if (targetDate > today) {
      throw new Error('Cannot update status - occurrence date has not arrived yet')
    }

    const result = await this.prisma.assessmentForm.updateMany({
      where: {
        ...(subjectId ? { subjectId } : { courseId }),
        occuranceDate,
        templateId,
        status: AssessmentStatus.NOT_STARTED
      },
      data: {
        status: AssessmentStatus.ON_GOING
      }
    })

    return {
      success: true,
      message: `Successfully updated ${result.count} assessment form(s) to ON_GOING status`,
      data: {
        updatedCount: result.count,
        newStatus: AssessmentStatus.ON_GOING
      }
    }
  }

  /**
   * Get assessment form with template and all values for PDF generation
   */
  async getAssessmentWithTemplateAndValues(assessmentId: string) {
    return await this.prisma.assessmentForm.findUnique({
      where: { id: assessmentId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            templateSchema: true,
            templateConfig: true,
            templateContent: true
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
            code: true,
            name: true
          }
        },
        course: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        sections: {
          include: {
            values: {
              include: {
                templateField: {
                  select: {
                    id: true,
                    fieldName: true,
                    fieldType: true
                  }
                }
              }
            }
          }
        }
      }
    })
  }

  /**
   * Get all assessment values for an assessment with parent context for proper nested mapping
   */
  async getAssessmentValues(assessmentId: string) {
    return await this.prisma.assessmentValue.findMany({
      where: {
        assessmentSection: {
          assessmentFormId: assessmentId
        }
      },
      include: {
        templateField: {
          select: {
            id: true,
            fieldName: true,
            fieldType: true,
            roleRequired: true,
            parentId: true,
            parent: {
              select: {
                id: true,
                fieldName: true,
                parentId: true,
                parent: {
                  select: {
                    id: true,
                    fieldName: true,
                    parentId: true
                  }
                }
              }
            }
          }
        }
      }
    })
  }

  /**
   * Update assessment form PDF URL
   */
  async updateAssessmentPdfUrl(assessmentId: string, pdfUrl: string) {
    return await this.prisma.assessmentForm.update({
      where: { id: assessmentId },
      data: { pdfUrl: pdfUrl }
    })
  }

  /**
   * Get assessments for a specific event in a subject
   * Combines logic from getAssessmentEvents to validate event existence with getSubjectAssessments response format
   */
  async getEventSubjectAssessments(
    subjectId: string,
    templateId: string,
    occuranceDate: Date,
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 1000,
    status?: AssessmentStatus,
    search?: string
  ): Promise<GetEventSubjectAssessmentsResType> {
    try {
      // Get enhanced subject and template information
      const [subjectInfo, templateInfo] = await Promise.all([
        this.prisma.subject.findUnique({
          where: { id: subjectId },
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            method: true,
            duration: true,
            type: true,
            passScore: true,
            startDate: true,
            endDate: true,
            status: true,
            course: {
              select: {
                id: true,
                name: true,
                code: true,
                description: true,
                maxNumTrainee: true,
                passScore: true,
                startDate: true,
                endDate: true,
                status: true
              }
            }
          }
        }),
        this.prisma.templateForm.findUnique({
          where: { id: templateId },
          select: {
            id: true,
            name: true,
            version: true,
            status: true,
            description: true,
            templateContent: true // The actual template document content
          }
        })
      ])

      if (!subjectInfo) {
        throw new Error('Subject not found')
      }
      if (!templateInfo) {
        throw new Error('Template not found')
      }

      // First validate that this event exists in the subject
      const eventExists = await this.prisma.assessmentForm.findFirst({
        where: {
          subjectId: subjectId,
          templateId: templateId,
          occuranceDate: occuranceDate
        }
      })

      if (!eventExists) {
        throw new Error('Event not found in subject')
      }

      // Get statistics for all assessments in this event
      const allEventAssessments = await this.prisma.assessmentForm.findMany({
        where: {
          subjectId: subjectId,
          templateId: templateId,
          occuranceDate: occuranceDate
        },
        select: {
          id: true,
          sections: {
            select: {
              assessedById: true
            }
          }
        }
      })

      // Calculate statistics
      const numberOfTrainees = allEventAssessments.length
      
      // Collect all unique assessor IDs from sections
      const allAssessorIds = new Set<string>()
      allEventAssessments.forEach(assessment => {
        assessment.sections.forEach(section => {
          if (section.assessedById) {
            allAssessorIds.add(section.assessedById)
          }
        })
      })
      
      // Filter to only count users with TRAINER role
      const trainersWhoAssessed = await this.prisma.user.findMany({
        where: {
          id: { in: Array.from(allAssessorIds) },
          role: {
            name: 'TRAINER'
          }
        },
        select: { id: true }
      })
      
      const numberOfParticipatedTrainers = trainersWhoAssessed.length

      // Now get filtered assessments for display
      const whereConditions: any = {
        subjectId: subjectId,
        templateId: templateId,
        occuranceDate: occuranceDate
      }

      // Add status filter if provided
      if (status) {
        whereConditions.status = status
      }

      // Add search filter if provided
      if (search && search.trim()) {
        whereConditions.OR = [
          {
            trainee: {
              OR: [
                { firstName: { contains: search.trim(), mode: 'insensitive' } },
                { lastName: { contains: search.trim(), mode: 'insensitive' } },
                { eid: { contains: search.trim(), mode: 'insensitive' } },
                { email: { contains: search.trim(), mode: 'insensitive' } }
              ]
            }
          },
          {
            name: { contains: search.trim(), mode: 'insensitive' }
          }
        ]
      }

      // Role-based access control (same as getSubjectAssessments)
      if (userRole === 'TRAINER') {
        // Check if trainer is assigned to this subject
        const trainerAssignment = await this.prisma.subjectInstructor.findFirst({
          where: {
            subjectId: subjectId,
            trainerUserId: userId
          }
        })

        if (!trainerAssignment) {
          throw new Error('Trainer is not assigned to this subject')
        }
      } else if (userRole === 'TRAINEE') {
        // Trainee can only see their own assessments
        whereConditions.traineeId = userId
      } else if (userRole === 'DEPARTMENT_HEAD') {
        // Department head can see assessments in their department
        // Add department validation if needed
      }

      // Get total count for pagination
      const totalItems = await this.prisma.assessmentForm.count({
        where: whereConditions
      })

      // Calculate pagination
      const totalPages = Math.ceil(totalItems / limit)
      const offset = (page - 1) * limit

      // Get assessments with pagination
      const assessments = await this.prisma.assessmentForm.findMany({
        where: whereConditions,
        include: {
          trainee: {
            select: {
              id: true,
              eid: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true
            }
          },
          template: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [
          { trainee: { eid: 'asc' } }
        ],
        skip: offset,
        take: limit
      })

      // Transform assessments to match TrainerAssessmentListItemSchema
      const transformedAssessments = assessments.map((assessment) => ({
        id: assessment.id,
        name: assessment.name,
        subjectId: assessment.subjectId,
        courseId: assessment.courseId,
        occuranceDate: assessment.occuranceDate,
        status: assessment.status,
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
        resultScore: assessment.resultScore,
        resultText: assessment.resultText,
        pdfUrl: assessment.pdfUrl,
        comment: assessment.comment,
        isTraineeLocked: assessment.isTraineeLocked,
        trainee: {
          id: assessment.trainee.id,
          eid: assessment.trainee.eid,
          fullName: `${assessment.trainee.lastName} ${assessment.trainee.middleName || ''} ${assessment.trainee.firstName}`.trim(),
          email: assessment.trainee.email
        }
      }))

      // Extract event name from first assessment (all assessments in same event have same base name before dash)
      const eventName = assessments.length > 0 ? assessments[0].name.split(' - ')[0] : 'Unknown Event'

      return {
        assessments: transformedAssessments,
        totalItems,
        page,
        limit,
        totalPages,
        numberOfTrainees,
        numberOfParticipatedTrainers,
        eventInfo: {
          name: eventName,
          occuranceDate: occuranceDate,
          templateId: templateId,
          subjectInfo: {
            id: subjectInfo.id,
            name: subjectInfo.name,
            code: subjectInfo.code,
            description: subjectInfo.description,
            method: subjectInfo.method,
            duration: subjectInfo.duration,
            type: subjectInfo.type,
            passScore: subjectInfo.passScore,
            startDate: subjectInfo.startDate,
            endDate: subjectInfo.endDate,
            status: subjectInfo.status,
            course: {
              id: subjectInfo.course.id,
              name: subjectInfo.course.name,
              code: subjectInfo.course.code,
              description: subjectInfo.course.description,
              maxNumTrainee: subjectInfo.course.maxNumTrainee,
              passScore: subjectInfo.course.passScore,
              startDate: subjectInfo.course.startDate,
              endDate: subjectInfo.course.endDate,
              status: subjectInfo.course.status
            }
          },
          templateInfo: {
            id: templateInfo.id,
            name: templateInfo.name,
            version: templateInfo.version,
            status: templateInfo.status,
            description: templateInfo.description,
            templateContent: templateInfo.templateContent
          }
        }
      }
    } catch (error) {
      console.error('Get event subject assessments failed:', error)
      throw error
    }
  }

  /**
   * Get assessments for a specific event in a course with enhanced statistics and details
   * Includes number of trainees, participated trainers, detailed course info, and template content
   */
  async getEventCourseAssessments(
    courseId: string,
    templateId: string,
    occuranceDate: Date,
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 1000,
    status?: AssessmentStatus,
    search?: string
  ): Promise<GetEventCourseAssessmentsResType> {
    try {
      // Get enhanced course and template information
      const [courseInfo, templateInfo] = await Promise.all([
        this.prisma.course.findUnique({
          where: { id: courseId },
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            maxNumTrainee: true,
            venue: true,
            note: true,
            passScore: true,
            startDate: true,
            endDate: true,
            level: true,
            status: true,
            department: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        }),
        this.prisma.templateForm.findUnique({
          where: { id: templateId },
          select: {
            id: true,
            name: true,
            version: true,
            status: true,
            description: true,
            templateContent: true // The actual template document content
          }
        })
      ])

      if (!courseInfo) {
        throw new Error('Course not found')
      }
      if (!templateInfo) {
        throw new Error('Template not found')
      }

      // First validate that this event exists in the course
      const eventExists = await this.prisma.assessmentForm.findFirst({
        where: {
          courseId: courseId,
          subjectId: null, // Course scope: only assessments where subjectId is null
          templateId: templateId,
          occuranceDate: occuranceDate
        }
      })

      if (!eventExists) {
        throw new Error('Event not found in course')
      }

      // Get statistics for all assessments in this event
      const allEventAssessments = await this.prisma.assessmentForm.findMany({
        where: {
          courseId: courseId,
          subjectId: null, // Course scope: only assessments where subjectId is null
          templateId: templateId,
          occuranceDate: occuranceDate
        },
        select: {
          id: true,
          sections: {
            select: {
              assessedById: true
            }
          }
        }
      })

      // Calculate statistics
      const numberOfTrainees = allEventAssessments.length
      
      // Collect all unique assessor IDs from sections
      const allAssessorIds = new Set<string>()
      allEventAssessments.forEach(assessment => {
        assessment.sections.forEach(section => {
          if (section.assessedById) {
            allAssessorIds.add(section.assessedById)
          }
        })
      })
      
      // Filter to only count users with TRAINER role
      const trainersWhoAssessed = await this.prisma.user.findMany({
        where: {
          id: { in: Array.from(allAssessorIds) },
          role: {
            name: 'TRAINER'
          }
        },
        select: { id: true }
      })
      
      const numberOfParticipatedTrainers = trainersWhoAssessed.length

      // Now get filtered assessments for display
      const whereConditions: any = {
        courseId: courseId,
        subjectId: null, // Course scope: only assessments where subjectId is null
        templateId: templateId,
        occuranceDate: occuranceDate
      }

      // Add status filter if provided
      if (status) {
        whereConditions.status = status
      }

      // Add search filter if provided
      if (search && search.trim()) {
        whereConditions.OR = [
          {
            trainee: {
              OR: [
                { firstName: { contains: search.trim(), mode: 'insensitive' } },
                { lastName: { contains: search.trim(), mode: 'insensitive' } },
                { eid: { contains: search.trim(), mode: 'insensitive' } },
                { email: { contains: search.trim(), mode: 'insensitive' } }
              ]
            }
          },
          {
            name: { contains: search.trim(), mode: 'insensitive' }
          }
        ]
      }

      // Role-based access control (same as getCourseAssessments)
      if (userRole === 'TRAINER') {
        // Check if trainer is assigned to this course
        const trainerAssignment = await this.prisma.courseInstructor.findFirst({
          where: {
            courseId: courseId,
            trainerUserId: userId
          }
        })

        if (!trainerAssignment) {
          throw new Error('Trainer is not assigned to this course')
        }
      } else if (userRole === 'TRAINEE') {
        // Trainee can only see their own assessments
        whereConditions.traineeId = userId
      } else if (userRole === 'DEPARTMENT_HEAD') {
        // Department head can see assessments in their department
        // Add department validation if needed
      }

      // Get total count for pagination
      const totalItems = await this.prisma.assessmentForm.count({
        where: whereConditions
      })

      // Calculate pagination
      const totalPages = Math.ceil(totalItems / limit)
      const offset = (page - 1) * limit

      // Get assessments with pagination
      const assessments = await this.prisma.assessmentForm.findMany({
        where: whereConditions,
        include: {
          trainee: {
            select: {
              id: true,
              eid: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true
            }
          },
          template: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [
          { trainee: { eid: 'asc' } }
        ],
        skip: offset,
        take: limit
      })

      // Transform assessments to match TrainerAssessmentListItemSchema
      const transformedAssessments = assessments.map((assessment) => ({
        id: assessment.id,
        name: assessment.name,
        subjectId: assessment.subjectId,
        courseId: assessment.courseId,
        occuranceDate: assessment.occuranceDate,
        status: assessment.status,
        resultScore: assessment.resultScore,
        resultText: assessment.resultText,
        pdfUrl: assessment.pdfUrl,
        comment: assessment.comment,
        isTraineeLocked: assessment.isTraineeLocked,
        trainee: {
          id: assessment.trainee.id,
          eid: assessment.trainee.eid,
          fullName: `${assessment.trainee.lastName} ${assessment.trainee.middleName || ''} ${assessment.trainee.firstName}`.trim(),
          email: assessment.trainee.email
        }
      }))

      // Extract event name from first assessment (all assessments in same event have same base name before dash)
      const eventName = assessments.length > 0 ? assessments[0].name.split(' - ')[0] : 'Unknown Event'

      return {
        assessments: transformedAssessments,
        totalItems,
        page,
        limit,
        totalPages,
        numberOfTrainees,
        numberOfParticipatedTrainers,
        eventInfo: {
          name: eventName,
          occuranceDate: occuranceDate,
          templateId: templateId,
          courseInfo: {
            id: courseInfo.id,
            name: courseInfo.name,
            code: courseInfo.code,
            description: courseInfo.description,
            maxNumTrainee: courseInfo.maxNumTrainee,
            venue: courseInfo.venue,
            note: courseInfo.note,
            passScore: courseInfo.passScore,
            startDate: courseInfo.startDate,
            endDate: courseInfo.endDate,
            level: courseInfo.level,
            status: courseInfo.status,
            department: {
              id: courseInfo.department.id,
              name: courseInfo.department.name,
              code: courseInfo.department.code
            }
          },
          templateInfo: {
            id: templateInfo.id,
            name: templateInfo.name,
            version: templateInfo.version,
            status: templateInfo.status,
            description: templateInfo.description,
            templateContent: templateInfo.templateContent
          }
        }
      }
    } catch (error) {
      console.error('Get event course assessments failed:', error)
      throw error
    }
  }

  /**
   * Archive assessment event - Cancel all assessments in NOT_STARTED status for a specific event
   * Events are identified by subjectId/courseId, templateId, and occuranceDate
   */
  async archiveAssessmentEvent(
    subjectId: string | undefined,
    courseId: string | undefined,
    templateId: string,
    occuranceDate: Date
  ): Promise<{
    success: boolean
    message: string
    data: {
      eventInfo: {
        name: string
        subjectId: string | null
        courseId: string | null
        templateId: string
        occuranceDate: Date
        entityInfo: {
          id: string
          name: string
          code: string
          type: 'subject' | 'course'
        }
      }
      archivedCount: number
      totalAssessments: number
    }
  }> {
    try {
      // Validate that either subjectId or courseId is provided, but not both
      if ((subjectId && courseId) || (!subjectId && !courseId)) {
        throw new BadRequestException('Either subjectId or courseId must be provided, but not both')
      }

      // Build the filter for assessments
      const baseFilter: any = {
        templateId,
        occuranceDate: {
          gte: new Date(occuranceDate.getFullYear(), occuranceDate.getMonth(), occuranceDate.getDate()),
          lt: new Date(occuranceDate.getFullYear(), occuranceDate.getMonth(), occuranceDate.getDate() + 1)
        }
      }

      if (subjectId) {
        baseFilter.subjectId = subjectId
        baseFilter.courseId = null
      } else {
        baseFilter.courseId = courseId
        baseFilter.subjectId = null
      }

      // Get all assessments for this event
      const allAssessments = await this.prismaClient.assessmentForm.findMany({
        where: baseFilter,
        select: {
          id: true,
          name: true,
          status: true,
          subjectId: true,
          courseId: true,
          templateId: true,
          occuranceDate: true,
          subject: subjectId
            ? {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            : false,
          course: courseId
            ? {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            : false,
          template: {
            select: {
              name: true
            }
          }
        }
      })

      if (allAssessments.length === 0) {
        throw new NotFoundException('No assessments found for the specified event')
      }

      // Check if all assessments are in NOT_STARTED status
      const notStartedAssessments = allAssessments.filter((a) => a.status === AssessmentStatus.NOT_STARTED)
      const otherStatusAssessments = allAssessments.filter((a) => a.status !== AssessmentStatus.NOT_STARTED)

      if (otherStatusAssessments.length > 0) {
        throw new BadRequestException(
          `Cannot archive event: ${otherStatusAssessments.length} assessment(s) are not in NOT_STARTED status. Only events with all assessments in NOT_STARTED status can be archived.`
        )
      }

      // Update all NOT_STARTED assessments to CANCELLED
      const updateResult = await this.prismaClient.assessmentForm.updateMany({
        where: {
          ...baseFilter,
          status: AssessmentStatus.NOT_STARTED
        },
        data: {
          status: AssessmentStatus.CANCELLED,
          updatedAt: new Date()
        }
      })

      // Prepare response data
      const firstAssessment = allAssessments[0]
      let entityInfo: {
        id: string
        name: string
        code: string
        type: 'subject' | 'course'
      }

      if (subjectId && firstAssessment.subject) {
        entityInfo = {
          id: firstAssessment.subject.id,
          name: firstAssessment.subject.name,
          code: firstAssessment.subject.code,
          type: 'subject'
        }
      } else if (courseId && firstAssessment.course) {
        entityInfo = {
          id: firstAssessment.course.id,
          name: firstAssessment.course.name,
          code: firstAssessment.course.code,
          type: 'course'
        }
      } else {
        throw new NotFoundException('Associated subject or course not found')
      }

      // Generate event name from template name and date
      const eventName = `${firstAssessment.template.name} - ${occuranceDate.toISOString().split('T')[0]}`

      return {
        success: true,
        message: `Successfully archived assessment event. ${updateResult.count} assessments have been cancelled.`,
        data: {
          eventInfo: {
            name: eventName,
            subjectId: subjectId || null,
            courseId: courseId || null,
            templateId,
            occuranceDate,
            entityInfo
          },
          archivedCount: updateResult.count,
          totalAssessments: allAssessments.length
        }
      }
    } catch (error) {
      console.error('Archive assessment event failed:', error)
      throw error
    }
  }
}

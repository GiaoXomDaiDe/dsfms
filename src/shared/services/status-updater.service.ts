import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { AssessmentStatus, Prisma } from '@prisma/client'
import { CourseStatus } from '~/shared/constants/course.constant'
import { SubjectEnrollmentStatus, SubjectStatus } from '~/shared/constants/subject.constant'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class StatusUpdaterService {
  private readonly logger = new Logger(StatusUpdaterService.name)
  private static readonly cancellableAssessmentStatuses: AssessmentStatus[] = [
    AssessmentStatus.NOT_STARTED,
    AssessmentStatus.ON_GOING,
    AssessmentStatus.DRAFT,
    AssessmentStatus.SIGNATURE_PENDING,
    AssessmentStatus.READY_TO_SUBMIT
  ]

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cron job chạy mỗi ngày đúng 00:00 (vừa qua ngày mới)
   * để cập nhật status của Course, Subject và Enrollment
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'update-academic-statuses',
    timeZone: 'Asia/Ho_Chi_Minh'
  })
  async handleStatusUpdate() {
    this.logger.log('Starting automatic status update...')

    try {
      await this.updateCourseStatuses()
      await this.updateSubjectStatuses()
      await this.updateEnrollmentStatuses()

      this.logger.log('Automatic status update completed successfully')
    } catch (error) {
      this.logger.error('Error during automatic status update', error)
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    name: 'assessment-schedule-keeper',
    timeZone: 'Asia/Ho_Chi_Minh'
  })
  async handleAssessmentSchedule() {
    this.logger.log('Starting assessment schedule cron...')
    try {
      const started = await this.activateAssessmentsForToday()
      const cancelled = await this.cancelExpiredAssessments()
      this.logger.log(`Assessment schedule cron finished: ${started} → ON_GOING, ${cancelled} → CANCELLED (expired)`)
    } catch (error) {
      this.logger.error('Error during assessment schedule cron', error)
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'assessment-cancel-on-enrollment',
    timeZone: 'Asia/Ho_Chi_Minh'
  })
  async handleCancelledEnrollmentAssessments() {
    this.logger.log('Starting assessment cancellation cron for cancelled enrollments...')
    try {
      const { subjectCancelled, courseCancelled } = await this.cancelAssessmentsForCancelledEnrollments()
      const cancellationSummary =
        `Assessment cancellation cron finished: ${subjectCancelled} subject-level, ` +
        `${courseCancelled} course-level → CANCELLED`
      this.logger.log(cancellationSummary)
    } catch (error) {
      this.logger.error('Error during assessment cancellation cron', error)
    }
  }

  /**
   * Cập nhật status của tất cả Courses dựa trên startDate và endDate
   */
  private async updateCourseStatuses() {
    const now = new Date()
    now.setHours(0, 0, 0, 0) // Reset về đầu ngày để so sánh chính xác

    // Cập nhật Course sang ON_GOING (startDate <= now <= endDate)
    const ongoingResult = await this.prisma.course.updateMany({
      where: {
        status: CourseStatus.PLANNED,
        deletedAt: null,
        startDate: {
          lte: now
        },
        endDate: {
          gte: now
        },
        AND: [
          {
            OR: [
              {
                instructors: {
                  some: {}
                }
              },
              {
                subjects: {
                  some: {
                    instructors: {
                      some: {}
                    }
                  }
                }
              }
            ]
          },
          {
            subjects: {
              some: {
                enrollments: {
                  some: {
                    status: {
                      not: SubjectEnrollmentStatus.CANCELLED
                    }
                  }
                }
              }
            }
          }
        ]
      },
      data: {
        status: CourseStatus.ON_GOING
      }
    })

    // Cập nhật Course sang COMPLETED (now > endDate)
    const completedResult = await this.prisma.course.updateMany({
      where: {
        status: {
          in: [CourseStatus.PLANNED, CourseStatus.ON_GOING]
        },
        deletedAt: null,
        endDate: {
          lt: now
        }
      },
      data: {
        status: CourseStatus.COMPLETED
      }
    })

    this.logger.log(`Course statuses updated: ${ongoingResult.count} → ON_GOING, ${completedResult.count} → COMPLETED`)
  }

  /**
   * Cập nhật status của tất cả Subjects dựa trên startDate và endDate
   */
  private async updateSubjectStatuses() {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const archivedResult = await this.prisma.subject.updateMany({
      where: {
        status: SubjectStatus.PLANNED,
        deletedAt: null,
        startDate: {
          lte: now
        },
        OR: [
          {
            instructors: {
              none: {}
            }
          },
          {
            enrollments: {
              none: {}
            }
          }
        ]
      },
      data: {
        status: SubjectStatus.ARCHIVED
      }
    })

    // Cập nhật Subject sang ON_GOING
    const ongoingResult = await this.prisma.subject.updateMany({
      where: {
        status: SubjectStatus.PLANNED,
        deletedAt: null,
        startDate: {
          lte: now
        },
        endDate: {
          gte: now
        },
        instructors: {
          some: {}
        },
        enrollments: {
          some: {
            status: {
              not: SubjectEnrollmentStatus.CANCELLED
            }
          }
        }
      },
      data: {
        status: SubjectStatus.ON_GOING
      }
    })

    // Cập nhật Subject sang COMPLETED
    const completedResult = await this.prisma.subject.updateMany({
      where: {
        status: {
          in: [SubjectStatus.PLANNED, SubjectStatus.ON_GOING]
        },
        deletedAt: null,
        endDate: {
          lt: now
        }
      },
      data: {
        status: SubjectStatus.COMPLETED
      }
    })

    if (archivedResult.count > 0) {
      this.logger.warn(`Subject statuses auto-archived due to missing trainers or enrollments: ${archivedResult.count}`)
    }

    this.logger.log(`Subject statuses updated: ${ongoingResult.count} → ON_GOING, ${completedResult.count} → COMPLETED`)
  }

  /**
   * Cập nhật status của tất cả Enrollments dựa trên Subject status
   * Enrollment follows Subject status:
   * - Subject PLANNED → Enrollment ENROLLED
   * - Subject ON_GOING → Enrollment ON_GOING
   * - Subject COMPLETED → Enrollment FINISHED
   */
  private async updateEnrollmentStatuses() {
    // 1. Cập nhật Enrollment sang ON_GOING khi Subject = ON_GOING
    const ongoingResult = await this.prisma.subjectEnrollment.updateMany({
      where: {
        status: SubjectEnrollmentStatus.ENROLLED,
        subject: {
          status: SubjectStatus.ON_GOING,
          deletedAt: null
        }
      },
      data: {
        status: SubjectEnrollmentStatus.ON_GOING
      }
    })

    // 2. Cập nhật Enrollment sang FINISHED khi Subject = COMPLETED
    const finishedResult = await this.prisma.subjectEnrollment.updateMany({
      where: {
        status: {
          in: [SubjectEnrollmentStatus.ENROLLED, SubjectEnrollmentStatus.ON_GOING]
        },
        subject: {
          status: SubjectStatus.COMPLETED,
          deletedAt: null
        }
      },
      data: {
        status: SubjectEnrollmentStatus.FINISHED
      }
    })

    this.logger.log(
      `Enrollment statuses updated: ${ongoingResult.count} → ON_GOING, ${finishedResult.count} → FINISHED`
    )
  }

  private async activateAssessmentsForToday() {
    const today = this.getStartOfToday()
    const { count } = await this.prisma.assessmentForm.updateMany({
      where: {
        status: AssessmentStatus.NOT_STARTED,
        occuranceDate: {
          lte: today
        }
      },
      data: {
        status: AssessmentStatus.ON_GOING
      }
    })

    return count
  }

  private async cancelExpiredAssessments() {
    const today = this.getStartOfToday()
    const { count } = await this.prisma.assessmentForm.updateMany({
      where: {
        occuranceDate: {
          lt: today
        },
        status: {
          in: StatusUpdaterService.cancellableAssessmentStatuses
        }
      },
      data: {
        status: AssessmentStatus.CANCELLED
      }
    })

    return count
  }

  private async cancelAssessmentsForCancelledEnrollments() {
    const cancellableStatuses = StatusUpdaterService.cancellableAssessmentStatuses

    const subjectAssessmentIds = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT af."id"
        FROM "Assessment_Form" af
        JOIN "Subject_Enrollment" se
          ON se."subjectId" = af."subjectId"
         AND se."traineeUserId" = af."traineeId"
        WHERE af."subjectId" IS NOT NULL
          AND af."status" IN (${Prisma.join(cancellableStatuses)})
          AND se."status" = ${SubjectEnrollmentStatus.CANCELLED}
      `
    )

    const subjectCancelled = await this.cancelAssessmentsByIds(subjectAssessmentIds.map((row) => row.id))

    const courseAssessmentIds = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT af."id"
        FROM "Assessment_Form" af
        WHERE af."courseId" IS NOT NULL
          AND af."status" IN (${Prisma.join(cancellableStatuses)})
          AND EXISTS (
            SELECT 1
            FROM "Subject_Enrollment" se
            JOIN "Subject" s ON s."id" = se."subjectId"
            WHERE se."traineeUserId" = af."traineeId"
              AND s."courseId" = af."courseId"
              AND se."status" = ${SubjectEnrollmentStatus.CANCELLED}
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "Subject_Enrollment" se
            JOIN "Subject" s ON s."id" = se."subjectId"
            WHERE se."traineeUserId" = af."traineeId"
              AND s."courseId" = af."courseId"
              AND se."status" <> ${SubjectEnrollmentStatus.CANCELLED}
          )
      `
    )

    const courseCancelled = await this.cancelAssessmentsByIds(courseAssessmentIds.map((row) => row.id))

    return { subjectCancelled, courseCancelled }
  }

  private async cancelAssessmentsByIds(ids: string[]) {
    if (!ids.length) return 0

    const { count } = await this.prisma.assessmentForm.updateMany({
      where: {
        id: {
          in: ids
        },
        status: {
          in: StatusUpdaterService.cancellableAssessmentStatuses
        }
      },
      data: {
        status: AssessmentStatus.CANCELLED
      }
    })

    return count
  }

  private getStartOfToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  }

  /**
   * Manual trigger để test hoặc force update
   * Có thể gọi từ admin endpoint nếu cần
   */
  async forceUpdateAllStatuses() {
    this.logger.log('Manual status update triggered')
    await this.handleStatusUpdate()
  }
}

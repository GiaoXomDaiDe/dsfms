import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { AssessmentStatus, Prisma } from '@prisma/client'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { CourseStatus } from '~/shared/constants/course.constant'
import { SubjectEnrollmentStatus, SubjectStatus } from '~/shared/constants/subject.constant'
import { PrismaService } from '~/shared/services/prisma.service'

dayjs.extend(utc)
dayjs.extend(timezone)

const APP_TIMEZONE = 'Asia/Ho_Chi_Minh'

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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'update-academic-statuses',
    timeZone: APP_TIMEZONE
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

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'assessment-schedule-keeper',
    timeZone: APP_TIMEZONE
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

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'assessment-cancel-on-enrollment',
    timeZone: APP_TIMEZONE
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

  private async updateCourseStatuses() {
    const today = this.getTodayDate()
    this.logToday('updateCourseStatuses', today)

    // PLANNED → ON_GOING (startDate <= today <= endDate)
    const ongoingResult = await this.prisma.course.updateMany({
      where: {
        status: CourseStatus.PLANNED,
        deletedAt: null,
        startDate: { lte: today },
        endDate: { gte: today }
      },
      data: {
        status: CourseStatus.ON_GOING,
        updatedAt: new Date()
      }
    })

    // PLANNED or ON_GOING → COMPLETED (today > endDate)
    const completedResult = await this.prisma.course.updateMany({
      where: {
        status: { in: [CourseStatus.PLANNED, CourseStatus.ON_GOING] },
        deletedAt: null,
        endDate: { lt: today }
      },
      data: {
        status: CourseStatus.COMPLETED,
        updatedAt: new Date()
      }
    })

    this.logger.log(`Course statuses updated: ${ongoingResult.count} → ON_GOING, ${completedResult.count} → COMPLETED`)
  }

  private async updateSubjectStatuses() {
    const today = this.getTodayDate()
    this.logToday('updateSubjectStatuses', today)

    // PLANNED → ON_GOING
    const ongoingResult = await this.prisma.subject.updateMany({
      where: {
        status: SubjectStatus.PLANNED,
        deletedAt: null,
        startDate: { lte: today },
        endDate: { gte: today }
      },
      data: {
        status: SubjectStatus.ON_GOING,
        updatedAt: new Date()
      }
    })

    // PLANNED or ON_GOING → COMPLETED
    const completedResult = await this.prisma.subject.updateMany({
      where: {
        status: { in: [SubjectStatus.PLANNED, SubjectStatus.ON_GOING] },
        deletedAt: null,
        endDate: { lt: today }
      },
      data: {
        status: SubjectStatus.COMPLETED,
        updatedAt: new Date()
      }
    })

    this.logger.log(`Subject statuses updated: ${ongoingResult.count} → ON_GOING, ${completedResult.count} → COMPLETED`)
  }

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
        status: SubjectEnrollmentStatus.ON_GOING,
        updatedAt: new Date()
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
        status: SubjectEnrollmentStatus.FINISHED,
        updatedAt: new Date()
      }
    })

    this.logger.log(
      `Enrollment statuses updated: ${ongoingResult.count} → ON_GOING, ${finishedResult.count} → FINISHED`
    )
  }
  private async activateAssessmentsForToday() {
    const today = this.getTodayDate()
    this.logToday('activateAssessmentsForToday', today)

    const { count } = await this.prisma.assessmentForm.updateMany({
      where: {
        status: AssessmentStatus.NOT_STARTED,
        occuranceDate: {
          equals: today // DATE 'YYYY-MM-DD'
        }
      },
      data: {
        status: AssessmentStatus.ON_GOING,
        updatedAt: new Date()
      }
    })

    this.logger.log(`activateAssessmentsForToday updated=${count}`)
    return count
  }

  private async cancelExpiredAssessments() {
    const today = this.getTodayDate()
    this.logToday('cancelExpiredAssessments', today)

    const { count } = await this.prisma.assessmentForm.updateMany({
      where: {
        occuranceDate: {
          lt: today // mọi ngày < hôm nay
        },
        status: {
          in: StatusUpdaterService.cancellableAssessmentStatuses
        }
      },
      data: {
        status: AssessmentStatus.CANCELLED,
        updatedAt: new Date()
      }
    })

    this.logger.log(`cancelExpiredAssessments updated=${count}`)
    return count
  }

  private async cancelAssessmentsForCancelledEnrollments() {
    const cancellableStatuses = StatusUpdaterService.cancellableAssessmentStatuses
    const cancellableStatusesSql = Prisma.join(
      cancellableStatuses.map((status) => Prisma.sql`${status}::"AssessmentStatus"`)
    )
    const cancelledEnrollmentStatusSql = Prisma.sql`${SubjectEnrollmentStatus.CANCELLED}::"SubjectEnrollmentStatus"`

    const subjectAssessmentIds = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT af."id"
        FROM "Assessment_Form" af
        JOIN "Subject_Enrollment" se
          ON se."subjectId" = af."subjectId"
          AND se."traineeUserId" = af."traineeId"
        WHERE af."subjectId" IS NOT NULL
          AND af."status" IN (${cancellableStatusesSql})
          AND se."status" = ${cancelledEnrollmentStatusSql}
      `
    )

    const subjectCancelled = await this.cancelAssessmentsByIds(subjectAssessmentIds.map((row) => row.id))

    const courseAssessmentIds = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT af."id"
        FROM "Assessment_Form" af
        WHERE af."courseId" IS NOT NULL
          AND af."status" IN (${cancellableStatusesSql})
          AND EXISTS (
            SELECT 1
            FROM "Subject_Enrollment" se
            JOIN "Subject" s ON s."id" = se."subjectId"
            WHERE se."traineeUserId" = af."traineeId"
              AND s."courseId" = af."courseId"
              AND se."status" = ${cancelledEnrollmentStatusSql}
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "Subject_Enrollment" se
            JOIN "Subject" s ON s."id" = se."subjectId"
            WHERE se."traineeUserId" = af."traineeId"
              AND s."courseId" = af."courseId"
              AND se."status" <> ${cancelledEnrollmentStatusSql}
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
        status: AssessmentStatus.CANCELLED,
        updatedAt: new Date()
      }
    })

    return count
  }

  private getTodayDate(): Date {
    return dayjs().tz(APP_TIMEZONE).startOf('day').toDate()
  }

  private logToday(context: string, today: Date) {
    this.logger.log(
      `[${context}] today (VN) = ${dayjs(today)
        .tz(APP_TIMEZONE)
        .format('YYYY-MM-DD HH:mm:ss')}, iso=${today.toISOString()}`
    )
  }
}

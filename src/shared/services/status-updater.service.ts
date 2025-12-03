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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
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

    // DEBUG: log today dạng date-only
    this.logger.debug(
      `[updateCourseStatuses] today (VN, date only) = ${dayjs(today).tz(APP_TIMEZONE).format('YYYY-MM-DD')}`
    )

    // DEBUG: các course PLANNED sẽ trở thành ON_GOING hôm nay
    const plannedToOngoing = await this.prisma.course.findMany({
      where: {
        status: CourseStatus.PLANNED,
        deletedAt: null,
        startDate: { lte: today },
        endDate: { gte: today }
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true
      }
    })

    this.logger.debug(
      `[updateCourseStatuses] candidates PLANNED → ON_GOING: ` +
        JSON.stringify(
          plannedToOngoing.map((c) => ({
            id: c.id,
            name: c.name,
            startDate: dayjs(c.startDate).format('YYYY-MM-DD'),
            endDate: dayjs(c.endDate).format('YYYY-MM-DD'),
            status: c.status
          })),
          null,
          2
        )
    )

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

    // DEBUG: các course PLANNED/ON_GOING sẽ bị COMPLETED hôm nay (hết hạn)
    const toCompleted = await this.prisma.course.findMany({
      where: {
        status: { in: [CourseStatus.PLANNED, CourseStatus.ON_GOING] },
        deletedAt: null,
        endDate: { lt: today }
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true
      }
    })

    this.logger.debug(
      `[updateCourseStatuses] candidates PLANNED/ON_GOING → COMPLETED: ` +
        JSON.stringify(
          toCompleted.map((c) => ({
            id: c.id,
            name: c.name,
            startDate: dayjs(c.startDate).format('YYYY-MM-DD'),
            endDate: dayjs(c.endDate).format('YYYY-MM-DD'),
            status: c.status
          })),
          null,
          2
        )
    )

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

    this.logger.debug(
      `[updateSubjectStatuses] today (VN, date only) = ${dayjs(today).tz(APP_TIMEZONE).format('YYYY-MM-DD')}`
    )

    // DEBUG: Subject PLANNED → ON_GOING hôm nay
    const plannedToOngoing = await this.prisma.subject.findMany({
      where: {
        status: SubjectStatus.PLANNED,
        deletedAt: null,
        startDate: { lte: today },
        endDate: { gte: today }
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true
      }
    })

    this.logger.debug(
      `[updateSubjectStatuses] candidates PLANNED → ON_GOING: ` +
        JSON.stringify(
          plannedToOngoing.map((s) => ({
            id: s.id,
            name: s.name,
            startDate: dayjs(s.startDate).format('YYYY-MM-DD'),
            endDate: dayjs(s.endDate).format('YYYY-MM-DD'),
            status: s.status
          })),
          null,
          2
        )
    )

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

    // DEBUG: Subject PLANNED/ON_GOING → COMPLETED
    const toCompleted = await this.prisma.subject.findMany({
      where: {
        status: { in: [SubjectStatus.PLANNED, SubjectStatus.ON_GOING] },
        deletedAt: null,
        endDate: { lt: today }
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true
      }
    })

    this.logger.debug(
      `[updateSubjectStatuses] candidates PLANNED/ON_GOING → COMPLETED: ` +
        JSON.stringify(
          toCompleted.map((s) => ({
            id: s.id,
            name: s.name,
            startDate: dayjs(s.startDate).format('YYYY-MM-DD'),
            endDate: dayjs(s.endDate).format('YYYY-MM-DD'),
            status: s.status
          })),
          null,
          2
        )
    )

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
    // DEBUG: Enrollment ENROLLED → ON_GOING (subject ON_GOING)
    const toOngoing = await this.prisma.subjectEnrollment.findMany({
      where: {
        status: SubjectEnrollmentStatus.ENROLLED,
        subject: {
          status: SubjectStatus.ON_GOING,
          deletedAt: null
        }
      },
      select: {
        traineeUserId: true,
        subjectId: true,
        status: true,
        subject: {
          select: {
            name: true,
            status: true
          }
        }
      }
    })

    this.logger.debug(
      `[updateEnrollmentStatuses] candidates ENROLLED → ON_GOING: ` +
        JSON.stringify(
          toOngoing.map((e) => ({
            traineeUserId: e.traineeUserId,
            subjectId: e.subjectId,
            enrollmentStatus: e.status,
            subjectName: e.subject?.name,
            subjectStatus: e.subject?.status
          })),
          null,
          2
        )
    )

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

    // DEBUG: Enrollment ENROLLED/ON_GOING → FINISHED (subject COMPLETED)
    const toFinished = await this.prisma.subjectEnrollment.findMany({
      where: {
        status: {
          in: [SubjectEnrollmentStatus.ENROLLED, SubjectEnrollmentStatus.ON_GOING]
        },
        subject: {
          status: SubjectStatus.COMPLETED,
          deletedAt: null
        }
      },
      select: {
        traineeUserId: true,
        subjectId: true,
        status: true,
        subject: {
          select: {
            name: true,
            status: true
          }
        }
      }
    })

    this.logger.debug(
      `[updateEnrollmentStatuses] candidates ENROLLED/ON_GOING → FINISHED: ` +
        JSON.stringify(
          toFinished.map((e) => ({
            traineeUserId: e.traineeUserId,
            subjectId: e.subjectId,
            enrollmentStatus: e.status,
            subjectName: e.subject?.name,
            subjectStatus: e.subject?.status
          })),
          null,
          2
        )
    )

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
    const todayStr = this.getTodayDateString()
    this.logger.log(`[activateAssessmentsForToday] today (VN, string) = ${todayStr}`)

    // Lấy những form NOT_STARTED có occuranceDate = today (DATE so sánh thuần)
    const raw = await this.prisma.$queryRaw<Array<{ id: string; name: string; occuranceDate: Date; status: string }>>(
      Prisma.sql`
      SELECT "id", "name", "occuranceDate", "status"
      FROM "Assessment_Form"
      WHERE "status" = ${AssessmentStatus.NOT_STARTED}::"AssessmentStatus"
        AND "occuranceDate" = ${todayStr}::date
    `
    )

    this.logger.debug(
      `[activateAssessmentsForToday] candidates (NOT_STARTED & occuranceDate = ${todayStr}): ` +
        JSON.stringify(
          raw.map((c) => ({
            id: c.id,
            name: c.name,
            occuranceDate: dayjs(c.occuranceDate).format('YYYY-MM-DD'),
            status: c.status
          })),
          null,
          2
        )
    )

    const ids = raw.map((r) => r.id)
    if (!ids.length) {
      this.logger.log('activateAssessmentsForToday updated=0')
      return 0
    }

    const { count } = await this.prisma.assessmentForm.updateMany({
      where: {
        id: { in: ids },
        status: AssessmentStatus.NOT_STARTED
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
    const todayStr = this.getTodayDateString()
    this.logger.log(`[cancelExpiredAssessments] today (VN, string) = ${todayStr}`)

    const cancellableStatuses = StatusUpdaterService.cancellableAssessmentStatuses
    const cancellableStatusesSql = Prisma.join(
      cancellableStatuses.map((status) => Prisma.sql`${status}::"AssessmentStatus"`)
    )

    // Lấy những form có occuranceDate < today và status thuộc nhóm cancellable
    const raw = await this.prisma.$queryRaw<Array<{ id: string; name: string; occuranceDate: Date; status: string }>>(
      Prisma.sql`
      SELECT "id", "name", "occuranceDate", "status"
      FROM "Assessment_Form"
      WHERE "occuranceDate" < ${todayStr}::date
        AND "status" IN (${cancellableStatusesSql})
    `
    )

    this.logger.debug(
      `[cancelExpiredAssessments] candidates (occuranceDate < ${todayStr} & cancellable): ` +
        JSON.stringify(
          raw.map((c) => ({
            id: c.id,
            name: c.name,
            occuranceDate: dayjs(c.occuranceDate).format('YYYY-MM-DD'),
            status: c.status
          })),
          null,
          2
        )
    )

    const ids = raw.map((r) => r.id)
    if (!ids.length) {
      this.logger.log('cancelExpiredAssessments updated=0')
      return 0
    }

    const { count } = await this.prisma.assessmentForm.updateMany({
      where: {
        id: { in: ids },
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
  private getTodayDateString(): string {
    return dayjs().tz(APP_TIMEZONE).format('YYYY-MM-DD')
  }

  private logToday(context: string, today: Date) {
    this.logger.log(
      `[${context}] today (VN) = ${dayjs(today)
        .tz(APP_TIMEZONE)
        .format('YYYY-MM-DD HH:mm:ss')}, iso=${today.toISOString()}`
    )
  }
}

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
const SAMPLE_IDS_LOG_LIMIT = 10

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
    const todayStr = this.getTodayDateString()
    this.logToday('handleStatusUpdate', new Date(`${todayStr}T00:00:00`))
    this.logger.log('Starting automatic status update...')

    try {
      await this.updateCourseStatuses(todayStr)
      await this.updateSubjectStatuses(todayStr)
      await this.updateEnrollmentStatuses(todayStr)

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
      this.logger.log(
        `Assessment cancellation cron finished: ${subjectCancelled} subject-level, ${courseCancelled} course-level → CANCELLED`
      )
    } catch (error) {
      this.logger.error('Error during assessment cancellation cron', error)
    }
  }

  private async updateCourseStatuses(todayStr: string) {
    // PLANNED -> ON_GOING count
    const plannedToOngoingCountRow = (await this.prisma.$queryRaw<Array<{ cnt: number }>>(
      Prisma.sql`
      SELECT COUNT(*)::int AS cnt
      FROM "Course"
      WHERE "status" = ${CourseStatus.PLANNED}::"CourseStatus"
        AND "deletedAt" IS NULL
        AND "startDate" <= ${todayStr}::date
        AND "endDate" >= ${todayStr}::date
    `
    )) as Array<{ cnt: number }>
    const plannedToOngoingCount = plannedToOngoingCountRow[0]?.cnt ?? 0

    if (plannedToOngoingCount > 0) {
      const sample = (await this.prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
        SELECT "id"
        FROM "Course"
        WHERE "status" = ${CourseStatus.PLANNED}::"CourseStatus"
          AND "deletedAt" IS NULL
          AND "startDate" <= ${todayStr}::date
          AND "endDate" >= ${todayStr}::date
        LIMIT ${SAMPLE_IDS_LOG_LIMIT}
      `
      )) as Array<{ id: string }>

      await this.prisma.$executeRaw(
        Prisma.sql`
        UPDATE "Course"
        SET "status" = ${CourseStatus.ON_GOING}::"CourseStatus",
            "updatedAt" = now()
        WHERE "status" = ${CourseStatus.PLANNED}::"CourseStatus"
          AND "deletedAt" IS NULL
          AND "startDate" <= ${todayStr}::date
          AND "endDate" >= ${todayStr}::date
      `
      )

      this.logger.log(`Course: ${plannedToOngoingCount} → ON_GOING; sample ids: ${sample.map((r) => r.id).join(', ')}`)
    } else {
      this.logger.log('Course: 0 → ON_GOING')
    }

    // PLANNED|ON_GOING -> COMPLETED count
    const toCompletedCountRow = (await this.prisma.$queryRaw<Array<{ cnt: number }>>(
      Prisma.sql`
      SELECT COUNT(*)::int AS cnt
      FROM "Course"
      WHERE "status" IN (${CourseStatus.PLANNED}::"CourseStatus", ${CourseStatus.ON_GOING}::"CourseStatus")
        AND "deletedAt" IS NULL
        AND "endDate" < ${todayStr}::date
    `
    )) as Array<{ cnt: number }>
    const toCompletedCount = toCompletedCountRow[0]?.cnt ?? 0

    if (toCompletedCount > 0) {
      const sampleCompleted = (await this.prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
        SELECT "id"
        FROM "Course"
        WHERE "status" IN (${CourseStatus.PLANNED}::"CourseStatus", ${CourseStatus.ON_GOING}::"CourseStatus")
          AND "deletedAt" IS NULL
          AND "endDate" < ${todayStr}::date
        LIMIT ${SAMPLE_IDS_LOG_LIMIT}
      `
      )) as Array<{ id: string }>

      await this.prisma.$executeRaw(
        Prisma.sql`
        UPDATE "Course"
        SET "status" = ${CourseStatus.COMPLETED}::"CourseStatus",
            "updatedAt" = now()
        WHERE "status" IN (${CourseStatus.PLANNED}::"CourseStatus", ${CourseStatus.ON_GOING}::"CourseStatus")
          AND "deletedAt" IS NULL
          AND "endDate" < ${todayStr}::date
      `
      )

      this.logger.log(
        `Course: ${toCompletedCount} → COMPLETED; sample ids: ${sampleCompleted.map((r) => r.id).join(', ')}`
      )
    } else {
      this.logger.log('Course: 0 → COMPLETED')
    }
  }

  private async updateSubjectStatuses(todayStr: string) {
    // PLANNED -> ON_GOING
    const plannedToOngoingCountRow = (await this.prisma.$queryRaw<Array<{ cnt: number }>>(
      Prisma.sql`
      SELECT COUNT(*)::int AS cnt
      FROM "Subject"
      WHERE "status" = ${SubjectStatus.PLANNED}::"SubjectStatus"
        AND "deletedAt" IS NULL
        AND "startDate" <= ${todayStr}::date
        AND "endDate" >= ${todayStr}::date
    `
    )) as Array<{ cnt: number }>
    const plannedToOngoingCount = plannedToOngoingCountRow[0]?.cnt ?? 0

    if (plannedToOngoingCount > 0) {
      const sample = (await this.prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
        SELECT "id"
        FROM "Subject"
        WHERE "status" = ${SubjectStatus.PLANNED}::"SubjectStatus"
          AND "deletedAt" IS NULL
          AND "startDate" <= ${todayStr}::date
          AND "endDate" >= ${todayStr}::date
        LIMIT ${SAMPLE_IDS_LOG_LIMIT}
      `
      )) as Array<{ id: string }>

      await this.prisma.$executeRaw(
        Prisma.sql`
        UPDATE "Subject"
        SET "status" = ${SubjectStatus.ON_GOING}::"SubjectStatus",
            "updatedAt" = now()
        WHERE "status" = ${SubjectStatus.PLANNED}::"SubjectStatus"
          AND "deletedAt" IS NULL
          AND "startDate" <= ${todayStr}::date
          AND "endDate" >= ${todayStr}::date
      `
      )

      this.logger.log(`Subject: ${plannedToOngoingCount} → ON_GOING; sample ids: ${sample.map((r) => r.id).join(', ')}`)
    } else {
      this.logger.log('Subject: 0 → ON_GOING')
    }

    // PLANNED|ON_GOING -> COMPLETED
    const toCompletedCountRow = (await this.prisma.$queryRaw<Array<{ cnt: number }>>(
      Prisma.sql`
      SELECT COUNT(*)::int AS cnt
      FROM "Subject"
      WHERE "status" IN (${SubjectStatus.PLANNED}::"SubjectStatus", ${SubjectStatus.ON_GOING}::"SubjectStatus")
        AND "deletedAt" IS NULL
        AND "endDate" < ${todayStr}::date
    `
    )) as Array<{ cnt: number }>
    const toCompletedCount = toCompletedCountRow[0]?.cnt ?? 0

    if (toCompletedCount > 0) {
      const sampleCompleted = (await this.prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
        SELECT "id"
        FROM "Subject"
        WHERE "status" IN (${SubjectStatus.PLANNED}::"SubjectStatus", ${SubjectStatus.ON_GOING}::"SubjectStatus")
          AND "deletedAt" IS NULL
          AND "endDate" < ${todayStr}::date
        LIMIT ${SAMPLE_IDS_LOG_LIMIT}
      `
      )) as Array<{ id: string }>

      await this.prisma.$executeRaw(
        Prisma.sql`
        UPDATE "Subject"
        SET "status" = ${SubjectStatus.COMPLETED}::"SubjectStatus",
            "updatedAt" = now()
        WHERE "status" IN (${SubjectStatus.PLANNED}::"SubjectStatus", ${SubjectStatus.ON_GOING}::"SubjectStatus")
          AND "deletedAt" IS NULL
          AND "endDate" < ${todayStr}::date
      `
      )

      this.logger.log(
        `Subject: ${toCompletedCount} → COMPLETED; sample ids: ${sampleCompleted.map((r) => r.id).join(', ')}`
      )
    } else {
      this.logger.log('Subject: 0 → COMPLETED')
    }
  }

  private async updateEnrollmentStatuses(todayStr: string) {
    // ENROLLED -> ON_GOING (subject ON_GOING)
    const toOngoingCountRow = (await this.prisma.$queryRaw<Array<{ cnt: number }>>(
      Prisma.sql`
      SELECT COUNT(*)::int AS cnt
      FROM "Subject_Enrollment" se
      JOIN "Subject" s ON s."id" = se."subjectId"
      WHERE se."status" = ${SubjectEnrollmentStatus.ENROLLED}::"SubjectEnrollmentStatus"
        AND s."status" = ${SubjectStatus.ON_GOING}::"SubjectStatus"
        AND s."deletedAt" IS NULL
    `
    )) as Array<{ cnt: number }>
    const toOngoingCount = toOngoingCountRow[0]?.cnt ?? 0

    if (toOngoingCount > 0) {
      const sample = (await this.prisma.$queryRaw<Array<{ subjectId: string }>>(
        Prisma.sql`
        SELECT se."subjectId"
        FROM "Subject_Enrollment" se
        JOIN "Subject" s ON s."id" = se."subjectId"
        WHERE se."status" = ${SubjectEnrollmentStatus.ENROLLED}::"SubjectEnrollmentStatus"
          AND s."status" = ${SubjectStatus.ON_GOING}::"SubjectStatus"
          AND s."deletedAt" IS NULL
        LIMIT ${SAMPLE_IDS_LOG_LIMIT}
      `
      )) as Array<{ subjectId: string }>

      await this.prisma.$executeRaw(
        Prisma.sql`
        UPDATE "Subject_Enrollment" se
        SET "status" = ${SubjectEnrollmentStatus.ON_GOING}::"SubjectEnrollmentStatus",
            "updatedAt" = now()
        FROM "Subject" s
        WHERE se."subjectId" = s."id"
          AND se."status" = ${SubjectEnrollmentStatus.ENROLLED}::"SubjectEnrollmentStatus"
          AND s."status" = ${SubjectStatus.ON_GOING}::"SubjectStatus"
          AND s."deletedAt" IS NULL
      `
      )

      this.logger.log(
        `Enrollment: ${toOngoingCount} → ON_GOING; sample subjectIds: ${sample.map((r) => r.subjectId).join(', ')}`
      )
    } else {
      this.logger.log('Enrollment: 0 → ON_GOING')
    }

    // ENROLLED|ON_GOING -> FINISHED (subject COMPLETED)
    const toFinishedCountRow = (await this.prisma.$queryRaw<Array<{ cnt: number }>>(
      Prisma.sql`
      SELECT COUNT(*)::int AS cnt
      FROM "Subject_Enrollment" se
      JOIN "Subject" s ON s."id" = se."subjectId"
      WHERE se."status" IN (${SubjectEnrollmentStatus.ENROLLED}::"SubjectEnrollmentStatus", ${SubjectEnrollmentStatus.ON_GOING}::"SubjectEnrollmentStatus")
        AND s."status" = ${SubjectStatus.COMPLETED}::"SubjectStatus"
        AND s."deletedAt" IS NULL
    `
    )) as Array<{ cnt: number }>
    const toFinishedCount = toFinishedCountRow[0]?.cnt ?? 0

    if (toFinishedCount > 0) {
      const sampleFinished = (await this.prisma.$queryRaw<Array<{ subjectId: string }>>(
        Prisma.sql`
        SELECT se."subjectId"
        FROM "Subject_Enrollment" se
        JOIN "Subject" s ON s."id" = se."subjectId"
        WHERE se."status" IN (${SubjectEnrollmentStatus.ENROLLED}::"SubjectEnrollmentStatus", ${SubjectEnrollmentStatus.ON_GOING}::"SubjectEnrollmentStatus")
          AND s."status" = ${SubjectStatus.COMPLETED}::"SubjectStatus"
          AND s."deletedAt" IS NULL
        LIMIT ${SAMPLE_IDS_LOG_LIMIT}
      `
      )) as Array<{ subjectId: string }>

      await this.prisma.$executeRaw(
        Prisma.sql`
        UPDATE "Subject_Enrollment" se
        SET "status" = ${SubjectEnrollmentStatus.FINISHED}::"SubjectEnrollmentStatus",
            "updatedAt" = now()
        FROM "Subject" s
        WHERE se."subjectId" = s."id"
          AND se."status" IN (${SubjectEnrollmentStatus.ENROLLED}::"SubjectEnrollmentStatus", ${SubjectEnrollmentStatus.ON_GOING}::"SubjectEnrollmentStatus")
          AND s."status" = ${SubjectStatus.COMPLETED}::"SubjectStatus"
          AND s."deletedAt" IS NULL
      `
      )

      this.logger.log(
        `Enrollment: ${toFinishedCount} → FINISHED; sample subjectIds: ${sampleFinished.map((r) => r.subjectId).join(', ')}`
      )
    } else {
      this.logger.log('Enrollment: 0 → FINISHED')
    }
  }

  private async activateAssessmentsForToday() {
    const todayStr = this.getTodayDateString()

    // For DATE column occuranceDate - use date string comparison
    const ids = (
      await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Assessment_Form"
      WHERE "status" = ${AssessmentStatus.NOT_STARTED}::"AssessmentStatus"
        AND "occuranceDate" = ${todayStr}::date
    `)
    ).map((r) => r.id)

    if (!ids.length) {
      this.logger.debug('activateAssessmentsForToday updated=0')
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

    const cancellableStatuses = StatusUpdaterService.cancellableAssessmentStatuses
    const cancellableStatusesSql = Prisma.join(
      cancellableStatuses.map((status) => Prisma.sql`${status}::"AssessmentStatus"`)
    )

    const ids = (
      await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Assessment_Form"
      WHERE "occuranceDate" < ${todayStr}::date
        AND "status" IN (${cancellableStatusesSql})
    `)
    ).map((r) => r.id)

    if (!ids.length) {
      this.logger.debug('cancelExpiredAssessments updated=0')
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

    const subjectIds = subjectAssessmentIds.map((row) => row.id)
    const subjectCancelled = await this.cancelAssessmentsByIds(subjectIds)

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

    const courseIds = courseAssessmentIds.map((row) => row.id)
    const courseCancelled = await this.cancelAssessmentsByIds(courseIds)

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

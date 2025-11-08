import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { AssessmentStatus } from '@prisma/client'
import { CourseStatus } from '~/shared/constants/course.constant'
import { SubjectEnrollmentStatus, SubjectStatus } from '~/shared/constants/subject.constant'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class StatusUpdaterService {
  private readonly logger = new Logger(StatusUpdaterService.name)

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
      await this.updateAssessmentStatuses()

      this.logger.log('Automatic status update completed successfully')
    } catch (error) {
      this.logger.error('Error during automatic status update', error)
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

  /**
   * Chuyển đổi status của Assessment từ NOT_STARTED sang ON_GOING khi ngày hiện tại >= startDate
   */
  private async updateAssessmentStatuses() {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const result = await this.prisma.assessmentForm.updateMany({
      where: {
        status: AssessmentStatus.NOT_STARTED,
        occuranceDate: {
          lte: now
        }
      },
      data: {
        status: AssessmentStatus.ON_GOING
      }
    })

    if (result.count > 0) {
      this.logger.log(`Assessment statuses updated: ${result.count} → ON_GOING`)
    }
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

import { Injectable } from '@nestjs/common'
import { AssessmentResult, AssessmentStatus, Prisma } from '@prisma/client'
import {
  AcademicOverviewResType,
  AssessmentStatusMetricType,
  CourseEffectivenessMetricType,
  DASHBOARD_ASSESSMENT_STATUSES,
  OngoingCourseMetricType,
  OngoingEnrollmentMetricType,
  TraineeDashboardResType,
  TrainingEffectivenessMetricType
} from '~/routes/dashboard/dashboard.model'
import { CourseStatus } from '~/shared/constants/course.constant'
import { SubjectEnrollmentStatus, SubjectStatus } from '~/shared/constants/subject.constant'
import { PrismaService } from '~/shared/services/prisma.service'

type ActiveDepartment = {
  id: string
  code: string
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAcademicOverview(): Promise<AcademicOverviewResType> {
    const departments = await this.getActiveDepartments()

    const [
      ongoingCourseByDepartment,
      ongoingEnrollmentByDepartment,
      assessmentStatusDistribution,
      trainingEffectivenessByDepartment
    ] = await Promise.all([
      this.getOngoingCourseByDepartment(departments),
      this.getOngoingEnrollmentByDepartment(departments),
      this.getAssessmentStatusDistribution(),
      this.getTrainingEffectivenessByDepartment(departments)
    ])

    return {
      ongoingCourseByDepartment,
      ongoingEnrollmentByDepartment,
      assessmentStatusDistribution,
      trainingEffectivenessByDepartment
    }
  }

  private async getActiveDepartments(): Promise<ActiveDepartment[]> {
    return this.prisma.department.findMany({
      where: {
        deletedAt: null,
        isActive: true
      },
      select: {
        id: true,
        code: true
      }
    })
  }

  private async getOngoingCourseByDepartment(departments: ActiveDepartment[]): Promise<OngoingCourseMetricType[]> {
    const onGoingCourseGroups = await this.prisma.course.groupBy({
      by: ['departmentId'],
      where: {
        status: CourseStatus.ON_GOING,
        deletedAt: null
      },
      _count: {
        id: true
      }
    })

    const courseCountByDept = new Map(onGoingCourseGroups.map((course) => [course.departmentId, course._count.id]))

    return departments.map((department) => ({
      departmentId: department.id,
      departmentCode: department.code,
      ongoingCourseCount: courseCountByDept.get(department.id) ?? 0
    }))
  }
  /**
   * Tính số lượng Subject_Enrollment đang ON_GOING theo Department.
   *
   * Phần 1: Chạy raw SQL để đếm số enrollment đang ON_GOING, group by departmentId.
   * Phần 2: Ghép kết quả đếm vào danh sách department active đầu vào, fill 0 nếu không có dữ liệu.
   */
  private async getOngoingEnrollmentByDepartment(
    departments: ActiveDepartment[]
  ): Promise<OngoingEnrollmentMetricType[]> {
    // ===== PHẦN 1: Lấy số lượng enrollment ON_GOING, group theo departmentId =====
    const ongoingEnrollmentGroups = await this.prisma.$queryRaw<
      {
        departmentId: string
        count: number
      }[]
    >(Prisma.sql`
      SELECT
        c."departmentId" AS "departmentId",   -- Lấy departmentId của course
        COUNT(*)::int AS "count"             -- Đếm số enrollment, ép về int
      FROM "Subject_Enrollment" se
      INNER JOIN "Subject" s
        ON s.id = se."subjectId"             -- Join enrollment với subject
       AND s."deletedAt" IS NULL             -- Chỉ lấy subject chưa bị soft-delete
      INNER JOIN "Course" c
        ON c.id = s."courseId"               -- Join subject với course
       AND c."deletedAt" IS NULL             -- Chỉ lấy course chưa bị soft-delete
      INNER JOIN "Department" d
        ON d.id = c."departmentId"           -- Join course với department
       AND d."deletedAt" IS NULL             -- Chỉ lấy department chưa bị soft-delete
       AND d."isActive" = true               -- Và đang active
      WHERE se.status = ${SubjectEnrollmentStatus.ON_GOING}::"SubjectEnrollmentStatus" 
        -- Chỉ tính những enrollment đang ở trạng thái ON_GOING
      GROUP BY c."departmentId"              -- Gom nhóm theo departmentId của course
    `)

    const enrollmentCountByDept = new Map(ongoingEnrollmentGroups.map((group) => [group.departmentId, group.count]))

    return departments.map((department) => ({
      departmentId: department.id,
      departmentCode: department.code,
      ongoingEnrollmentCount: enrollmentCountByDept.get(department.id) ?? 0
    }))
  }

  private async getAssessmentStatusDistribution(): Promise<AssessmentStatusMetricType[]> {
    const assessmentGroups = await this.prisma.assessmentForm.groupBy({
      by: ['status'],
      _count: {
        _all: true
      }
    })

    const assessmentCountByStatus = new Map(assessmentGroups.map((group) => [group.status, group._count._all]))

    return DASHBOARD_ASSESSMENT_STATUSES.map((status) => ({
      status,
      count: assessmentCountByStatus.get(status) ?? 0
    }))
  }

  private async getTrainingEffectivenessByDepartment(
    departments: ActiveDepartment[]
  ): Promise<TrainingEffectivenessMetricType[]> {
    const effectivenessRaw = await this.prisma.$queryRaw<
      {
        departmentId: string
        departmentCode: string
        courseId: string
        courseName: string
        passCount: number
        failCount: number
        totalApproved: number
      }[]
    >(
      Prisma.sql`
      -- Chuẩn hoá courseId cho mỗi assessment form:
      -- Nếu form gắn trực tiếp vào courseId thì dùng luôn courseId.
      -- Nếu form gắn vào subjectId thì lấy subj.courseId.
      WITH resolved_forms AS (
        SELECT
          af.id,
          COALESCE(af."courseId", subj."courseId") AS "courseId",
          af."resultText",
          af.status
        FROM "Assessment_Form" af
        LEFT JOIN "Subject" subj
          ON subj.id = af."subjectId"
         AND subj."deletedAt" IS NULL
      )
      SELECT
        d.id   AS "departmentId",
        d.name AS "departmentName",
        d.code AS "departmentCode",
        c.id   AS "courseId",
        c.name AS "courseName",
        -- Đếm số form có resultText = PASS
        SUM(
          CASE WHEN rf."resultText" = ${AssessmentResult.PASS}::"AssessmentResult"
               THEN 1 ELSE 0 END
        )::int AS "passCount",
        -- Đếm số form có resultText = FAIL
        SUM(
          CASE WHEN rf."resultText" = ${AssessmentResult.FAIL}::"AssessmentResult"
               THEN 1 ELSE 0 END
        )::int AS "failCount",
        -- Tổng số form approved (PASS/FAIL/hoặc kết quả khác)
        COUNT(*)::int AS "totalApproved"
      FROM resolved_forms rf
      INNER JOIN "Course" c
        ON c.id = rf."courseId"
       AND c."deletedAt" IS NULL
      INNER JOIN "Department" d
        ON d.id = c."departmentId"
       AND d."deletedAt" IS NULL
       AND d."isActive" = true
      WHERE rf.status = ${AssessmentStatus.APPROVED}::"AssessmentStatus"
      GROUP BY d.id, d.name, c.id, c.name
      ORDER BY d.name, c.name
    `
    )

    // Gom kết quả theo departmentId
    const effectivenessByDept = new Map<string, TrainingEffectivenessMetricType>()

    for (const row of effectivenessRaw) {
      const departmentMetric = effectivenessByDept.get(row.departmentId)

      const courseMetric: CourseEffectivenessMetricType = {
        courseId: row.courseId,
        courseName: row.courseName,
        passCount: row.passCount,
        failCount: row.failCount,
        totalApproved: row.totalApproved
      }

      // Nếu department này chưa có trong map, khởi tạo mới
      if (!departmentMetric) {
        effectivenessByDept.set(row.departmentId, {
          departmentId: row.departmentId,
          departmentCode: row.departmentCode,
          passCount: row.passCount,
          failCount: row.failCount,
          totalApproved: row.totalApproved,
          courses: [courseMetric]
        })
        continue
      }

      // Nếu đã có, bổ sung course vào danh sách và cộng dồn số liệu
      departmentMetric.courses.push(courseMetric)
      departmentMetric.passCount += row.passCount
      departmentMetric.failCount += row.failCount
      departmentMetric.totalApproved += row.totalApproved
    }

    // Sort danh sách course trong từng department theo tên course cho dễ đọc
    for (const metric of effectivenessByDept.values()) {
      metric.courses.sort((a, b) => a.courseName.localeCompare(b.courseName))
    }

    // Trả về đủ mọi department active; nếu department không có dữ liệu thì fill 0
    return departments.map((department) => {
      const effectiveness = effectivenessByDept.get(department.id)
      if (effectiveness) {
        return effectiveness
      }

      return {
        departmentId: department.id,
        departmentCode: department.code,
        passCount: 0,
        failCount: 0,
        totalApproved: 0,
        courses: []
      }
    })
  }

  async getTraineeOverview(traineeId: string): Promise<TraineeDashboardResType> {
    const [totalAssessments, approvedAssessments, passCount, failCount, ongoingSubjectCount, ongoingCourseCount] =
      await Promise.all([
        this.prisma.assessmentForm.count({
          where: { traineeId }
        }),
        this.prisma.assessmentForm.count({
          where: {
            traineeId,
            status: AssessmentStatus.APPROVED
          }
        }),
        this.prisma.assessmentForm.count({
          where: {
            traineeId,
            status: AssessmentStatus.APPROVED,
            resultText: AssessmentResult.PASS
          }
        }),
        this.prisma.assessmentForm.count({
          where: {
            traineeId,
            status: AssessmentStatus.APPROVED,
            resultText: AssessmentResult.FAIL
          }
        }),
        this.prisma.subjectEnrollment.count({
          where: {
            traineeUserId: traineeId,
            status: SubjectEnrollmentStatus.ON_GOING,
            subject: {
              status: SubjectStatus.ON_GOING,
              deletedAt: null,
              course: {
                deletedAt: null
              }
            }
          }
        }),
        this.prisma.course.count({
          where: {
            status: CourseStatus.ON_GOING,
            deletedAt: null,
            subjects: {
              some: {
                deletedAt: null,
                enrollments: {
                  some: {
                    traineeUserId: traineeId,
                    status: SubjectEnrollmentStatus.ON_GOING
                  }
                }
              }
            }
          }
        })
      ])

    const completionRate = totalAssessments === 0 ? 0 : approvedAssessments / totalAssessments
    const passRatio = totalAssessments === 0 ? 0 : passCount / totalAssessments
    const failRatio = totalAssessments === 0 ? 0 : failCount / totalAssessments

    return {
      assessmentProgress: {
        approvedCount: approvedAssessments,
        totalAssigned: totalAssessments,
        completionRate
      },
      ongoingTraining: {
        ongoingCourses: ongoingCourseCount,
        ongoingSubjects: ongoingSubjectCount
      },
      assessmentRatios: {
        passCount,
        failCount,
        totalAssessments,
        passRatio,
        failRatio
      }
    }
  }
}

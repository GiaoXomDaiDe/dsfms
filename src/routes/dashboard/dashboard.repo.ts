import { Injectable } from '@nestjs/common'
import { AssessmentResult, AssessmentStatus } from '@prisma/client'
import { CourseStatus } from '~/shared/constants/course.constant'
import { SubjectEnrollmentStatus } from '~/shared/constants/subject.constant'
import { PrismaService } from '~/shared/services/prisma.service'

type ActiveDepartment = {
  id: string
  name: string
}

type DepartmentMetric = {
  departmentId: string
  departmentName: string
}

type OngoingCourseMetric = DepartmentMetric & {
  ongoingCourseCount: number
}

type OngoingEnrollmentMetric = DepartmentMetric & {
  ongoingEnrollmentCount: number
}

type AssessmentStatusMetric = {
  status: AssessmentStatus
  count: number
}

type CourseEffectivenessMetric = {
  courseId: string
  courseName: string
  passCount: number
  failCount: number
  totalApproved: number
}

type TrainingEffectivenessMetric = DepartmentMetric & {
  passCount: number
  failCount: number
  totalApproved: number
  courses: CourseEffectivenessMetric[]
}

export type AcademicOverview = {
  ongoingCourseByDepartment: OngoingCourseMetric[]
  ongoingEnrollmentByDepartment: OngoingEnrollmentMetric[]
  assessmentStatusDistribution: AssessmentStatusMetric[]
  trainingEffectivenessByDepartment: TrainingEffectivenessMetric[]
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAcademicOverview(): Promise<AcademicOverview> {
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
        name: true
      }
    })
  }

  private async getOngoingCourseByDepartment(departments: ActiveDepartment[]): Promise<OngoingCourseMetric[]> {
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
      departmentName: department.name,
      ongoingCourseCount: courseCountByDept.get(department.id) ?? 0
    }))
  }

  private async getOngoingEnrollmentByDepartment(departments: ActiveDepartment[]): Promise<OngoingEnrollmentMetric[]> {
    const ongoingEnrollmentGroups = await this.prisma.$queryRaw<
      {
        departmentId: string
        count: number
      }[]
    >`
      SELECT
        c."departmentId" AS "departmentId",
        COUNT(*)::int AS "count"
      FROM "Subject_Enrollment" se
      INNER JOIN "Subject" s ON s.id = se."subjectId" AND s."deletedAt" IS NULL
      INNER JOIN "Course" c ON c.id = s."courseId" AND c."deletedAt" IS NULL
      INNER JOIN "Department" d ON d.id = c."departmentId" AND d."deletedAt" IS NULL AND d."isActive" = true
      WHERE se.status = ${SubjectEnrollmentStatus.ON_GOING}
      GROUP BY c."departmentId"
    `

    const enrollmentCountByDept = new Map(ongoingEnrollmentGroups.map((group) => [group.departmentId, group.count]))

    return departments.map((department) => ({
      departmentId: department.id,
      departmentName: department.name,
      ongoingEnrollmentCount: enrollmentCountByDept.get(department.id) ?? 0
    }))
  }

  private async getAssessmentStatusDistribution(): Promise<AssessmentStatusMetric[]> {
    const assessmentGroups = await this.prisma.assessmentForm.groupBy({
      by: ['status'],
      _count: {
        _all: true
      }
    })

    const assessmentCountByStatus = new Map(assessmentGroups.map((group) => [group.status, group._count._all]))

    return (Object.values(AssessmentStatus) as AssessmentStatus[]).map((status) => ({
      status,
      count: assessmentCountByStatus.get(status) ?? 0
    }))
  }

  private async getTrainingEffectivenessByDepartment(
    departments: ActiveDepartment[]
  ): Promise<TrainingEffectivenessMetric[]> {
    const effectivenessRaw = await this.prisma.$queryRaw<
      {
        departmentId: string
        departmentName: string
        courseId: string
        courseName: string
        passCount: number
        failCount: number
        totalApproved: number
      }[]
    >`
      -- Resolve the owning course for assessments that may reference either a course or a subject.
      WITH resolved_forms AS (
        SELECT
          af.id,
          COALESCE(af."courseId", subj."courseId") AS "courseId",
          af."resultText",
          af.status
        FROM "Assessment_Form" af
        LEFT JOIN "Subject" subj ON subj.id = af."subjectId" AND subj."deletedAt" IS NULL
      )
      SELECT
        d.id AS "departmentId",
        d.name AS "departmentName",
        c.id AS "courseId",
        c.name AS "courseName",
        SUM(CASE WHEN rf."resultText" = ${AssessmentResult.PASS} THEN 1 ELSE 0 END)::int AS "passCount",
        SUM(CASE WHEN rf."resultText" = ${AssessmentResult.FAIL} THEN 1 ELSE 0 END)::int AS "failCount",
        COUNT(*)::int AS "totalApproved"
      FROM resolved_forms rf
      INNER JOIN "Course" c ON c.id = rf."courseId" AND c."deletedAt" IS NULL
      INNER JOIN "Department" d ON d.id = c."departmentId" AND d."deletedAt" IS NULL AND d."isActive" = true
      WHERE rf.status = ${AssessmentStatus.APPROVED}
      GROUP BY d.id, d.name, c.id, c.name
      ORDER BY d.name, c.name
    `

    const effectivenessByDept = new Map<string, TrainingEffectivenessMetric>()

    for (const row of effectivenessRaw) {
      const departmentMetric = effectivenessByDept.get(row.departmentId)

      const courseMetric: CourseEffectivenessMetric = {
        courseId: row.courseId,
        courseName: row.courseName,
        passCount: row.passCount,
        failCount: row.failCount,
        totalApproved: row.totalApproved
      }

      if (!departmentMetric) {
        effectivenessByDept.set(row.departmentId, {
          departmentId: row.departmentId,
          departmentName: row.departmentName,
          passCount: row.passCount,
          failCount: row.failCount,
          totalApproved: row.totalApproved,
          courses: [courseMetric]
        })
        continue
      }

      departmentMetric.courses.push(courseMetric)
      departmentMetric.passCount += row.passCount
      departmentMetric.failCount += row.failCount
      departmentMetric.totalApproved += row.totalApproved
    }

    for (const metric of effectivenessByDept.values()) {
      metric.courses.sort((a, b) => a.courseName.localeCompare(b.courseName))
    }

    return departments.map((department) => {
      const effectiveness = effectivenessByDept.get(department.id)
      if (effectiveness) {
        return effectiveness
      }

      return {
        departmentId: department.id,
        departmentName: department.name,
        passCount: 0,
        failCount: 0,
        totalApproved: 0,
        courses: []
      }
    })
  }
}

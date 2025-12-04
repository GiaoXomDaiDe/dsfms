import { Prisma } from '@prisma/client'
import { SubjectEnrollmentStatus } from '~/shared/constants/subject.constant'

export const subjectCourseSummarySelect = {
  id: true,
  code: true,
  name: true,
  status: true
} satisfies Prisma.CourseSelect

export const subjectCourseNameSelect = {
  id: true,
  name: true
} satisfies Prisma.CourseSelect

export const subjectCourseDetailSelect = {
  ...subjectCourseSummarySelect,
  department: {
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true
    }
  }
} satisfies Prisma.CourseSelect

export const subjectRepositorySubjectSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  method: true,
  type: true,
  course: {
    select: subjectCourseSummarySelect
  }
} satisfies Prisma.SubjectSelect

export const subjectAssignmentSummarySelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  courseId: true,
  startDate: true,
  endDate: true,
  course: {
    select: subjectCourseNameSelect
  }
} satisfies Prisma.SubjectSelect

export const subjectEnrollmentSummarySelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  method: true,
  type: true,
  course: {
    select: subjectCourseSummarySelect
  }
} satisfies Prisma.SubjectSelect

export const subjectTraineeCourseSubjectsSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  method: true,
  type: true,
  startDate: true,
  endDate: true,
  course: {
    select: subjectCourseSummarySelect
  }
} satisfies Prisma.SubjectSelect

export const subjectEnrollmentDetailSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  type: true,
  method: true,
  startDate: true,
  endDate: true,
  course: {
    select: subjectCourseNameSelect
  }
} satisfies Prisma.SubjectSelect

export const subjectListCountInclude = {
  _count: {
    select: {
      instructors: true,
      enrollments: {
        where: {
          status: { not: SubjectEnrollmentStatus.CANCELLED }
        }
      }
    }
  }
} satisfies Prisma.SubjectInclude

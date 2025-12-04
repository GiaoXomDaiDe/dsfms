import { Prisma } from '@prisma/client'

export const subjectEnrollmentTraineeSelect = {
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  department: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.UserSelect

export const subjectEnrollmentCourseSelect = {
  id: true,
  name: true
} satisfies Prisma.CourseSelect

export const subjectEnrollmentSubjectSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  type: true,
  method: true,
  startDate: true,
  endDate: true,
  course: {
    select: subjectEnrollmentCourseSelect
  }
} satisfies Prisma.SubjectSelect

export const courseTraineeEnrollmentsInclude = {
  trainee: {
    select: subjectEnrollmentTraineeSelect
  },
  subject: {
    select: subjectEnrollmentSubjectSelect
  }
} satisfies Prisma.SubjectEnrollmentInclude

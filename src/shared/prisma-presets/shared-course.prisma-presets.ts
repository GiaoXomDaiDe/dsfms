import { Prisma } from '@prisma/client'

export const courseDepartmentSummarySelect = {
  id: true,
  name: true,
  code: true,
  description: true
} satisfies Prisma.DepartmentSelect

export const courseTrainerSummarySelect = {
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  status: true
} satisfies Prisma.UserSelect

export const courseBasicInfoSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true
} satisfies Prisma.CourseSelect

export const courseInstructorSummaryInclude = {
  trainer: {
    select: courseTrainerSummarySelect
  },
  course: {
    select: courseBasicInfoSelect
  }
} satisfies Prisma.CourseInstructorInclude

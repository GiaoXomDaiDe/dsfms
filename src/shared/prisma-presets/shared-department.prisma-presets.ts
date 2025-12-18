import type { Prisma } from '@prisma/client'

export const departmentHeadBasicSelect = {
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true
} satisfies Prisma.UserSelect

export const departmentHeadWithRoleSelect = {
  ...departmentHeadBasicSelect,
  role: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.UserSelect

export const departmentWithHeadInclude = {
  headUser: {
    select: departmentHeadWithRoleSelect
  }
} satisfies Prisma.DepartmentInclude

export const departmentWithHeadBasicInclude = {
  headUser: {
    select: departmentHeadBasicSelect
  }
} satisfies Prisma.DepartmentInclude

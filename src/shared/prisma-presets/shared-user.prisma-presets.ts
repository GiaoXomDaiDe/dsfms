import { Prisma } from '@prisma/client'

export const roleNameSelect = {
  name: true
} satisfies Prisma.RoleSelect

export const roleSummarySelect = {
  id: true,
  name: true,
  description: true,
  isActive: true
} satisfies Prisma.RoleSelect

export const roleIdNameSelect = {
  id: true,
  name: true
} satisfies Prisma.RoleSelect

export const departmentNameSelect = {
  name: true
} satisfies Prisma.DepartmentSelect

export const departmentSummarySelect = {
  id: true,
  name: true,
  description: true,
  isActive: true
} satisfies Prisma.DepartmentSelect

export const departmentIdNameSelect = {
  id: true,
  name: true
} satisfies Prisma.DepartmentSelect

export const userRoleNameInclude = {
  role: {
    select: roleNameSelect
  }
} satisfies Prisma.UserInclude

export const userRoleDepartmentNameInclude = {
  role: {
    select: roleNameSelect
  },
  department: {
    select: departmentNameSelect
  }
} satisfies Prisma.UserInclude

export const userRoleDepartmentSummaryInclude = {
  role: {
    select: roleSummarySelect
  },
  department: {
    select: departmentSummarySelect
  }
} satisfies Prisma.UserInclude

export const userRoleDepartmentInclude = {
  role: {
    select: roleSummarySelect
  },
  department: {
    select: departmentSummarySelect
  }
} satisfies Prisma.UserInclude

export const userRoleDepartmentProfileInclude = {
  ...userRoleDepartmentInclude,
  trainerProfile: true,
  traineeProfile: true
} satisfies Prisma.UserInclude

export const userTrainerContactSelect = {
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  status: true
} satisfies Prisma.UserSelect

export const userTrainerWithDepartmentSelect = {
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  status: true,
  department: {
    select: departmentIdNameSelect
  }
} satisfies Prisma.UserSelect

export const userTrainerDirectorySelect = {
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  status: true,
  departmentId: true
} satisfies Prisma.UserSelect

export const userTraineeBasicStatusSelect = {
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  status: true
} satisfies Prisma.UserSelect

export const userTraineeWithDepartmentSelect = {
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  status: true,
  department: {
    select: departmentIdNameSelect
  }
} satisfies Prisma.UserSelect

export const userTraineeDirectorySelect = {
  id: true,
  eid: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
  departmentId: true,
  department: {
    select: departmentIdNameSelect
  }
} satisfies Prisma.UserSelect

export const userEidOnlySelect = {
  eid: true
} satisfies Prisma.UserSelect

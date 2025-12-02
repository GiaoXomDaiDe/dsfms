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

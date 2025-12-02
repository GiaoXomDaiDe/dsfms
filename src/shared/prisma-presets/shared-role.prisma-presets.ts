import { Prisma } from '@prisma/client'

export const activeEndpointPermissionFilter = {
  deletedAt: null,
  isActive: true
} satisfies Prisma.EndpointPermissionWhereInput

export const roleListWithUserCountInclude = {
  _count: {
    select: {
      users: true
    }
  }
} satisfies Prisma.RoleInclude

export const roleDetailInclude = {
  permissions: {
    where: activeEndpointPermissionFilter
  },
  _count: {
    select: {
      users: {
        where: {
          deletedAt: null
        }
      },
      permissions: {
        where: activeEndpointPermissionFilter
      }
    }
  }
} satisfies Prisma.RoleInclude

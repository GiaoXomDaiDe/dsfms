import { Prisma } from '@prisma/client'

export const permissionGroupSummarySelect = {
  id: true,
  groupName: true,
  name: true,
  permissionGroupCode: true
} satisfies Prisma.PermissionGroupSelect

export const permissionGroupOrderBy = [
  { groupName: 'asc' },
  { permissionGroupCode: 'asc' }
] satisfies Prisma.PermissionGroupOrderByWithRelationInput[]

const activeEndpointMappingRelation = {
  where: {
    endpointPermission: {
      deletedAt: null,
      isActive: true
    }
  },
  select: {
    endpointPermissionId: true
  }
} satisfies Prisma.PermissionGroupToEndpointPermissionFindManyArgs

export const permissionGroupActiveEndpointMappingInclude = {
  permissions: activeEndpointMappingRelation
} satisfies Prisma.PermissionGroupInclude

export const permissionGroupActiveEndpointMappingSelect = {
  ...permissionGroupSummarySelect,
  permissions: activeEndpointMappingRelation
} satisfies Prisma.PermissionGroupSelect

export const endpointPermissionSummarySelect = {
  id: true,
  name: true,
  method: true,
  path: true,
  module: true,
  description: true,
  viewModule: true,
  viewName: true
} satisfies Prisma.EndpointPermissionSelect

export const permissionGroupDetailSelect = {
  ...permissionGroupSummarySelect,
  permissions: {
    select: {
      endpointPermission: {
        select: endpointPermissionSummarySelect
      }
    }
  }
} satisfies Prisma.PermissionGroupSelect

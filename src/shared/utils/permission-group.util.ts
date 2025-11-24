import { groupBy } from 'lodash'

export type PermissionGroupDisplayRecord = {
  groupName: string
  permissionGroupCode: string
  name: string
}

export type PermissionGroupDisplay = {
  featureGroup: string
  permissions: Array<{
    code: string
    name: string
  }>
}

export type PermissionGroupDisplayWithCount = PermissionGroupDisplay & {
  permissionCount: number
}

export const mapPermissionGroups = <T extends PermissionGroupDisplayRecord>(
  permissionGroups: T[]
): PermissionGroupDisplay[] => {
  const grouped = groupBy(permissionGroups, 'groupName')

  return Object.entries(grouped).map(([groupName, permissions]) => ({
    featureGroup: groupName,
    permissions: permissions.map((permission) => ({
      code: permission.permissionGroupCode,
      name: permission.name
    }))
  }))
}

export const mapPermissionGroupsWithCounts = <T extends PermissionGroupDisplayRecord>(
  permissionGroups: T[]
): PermissionGroupDisplayWithCount[] => {
  const grouped = mapPermissionGroups(permissionGroups)

  return grouped.map((group) => ({
    ...group,
    permissionCount: group.permissions.length
  }))
}

export const countPermissionsAcrossGroups = (groups: PermissionGroupDisplay[]): number =>
  groups.reduce((total, group) => total + group.permissions.length, 0)

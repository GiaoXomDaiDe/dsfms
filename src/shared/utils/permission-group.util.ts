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

  const getCodeValue = (code: string) => {
    const numeric = parseInt(code.replace(/\D/g, ''), 10)
    return Number.isNaN(numeric) ? Number.MAX_SAFE_INTEGER : numeric
  }

  return Object.entries(grouped)
    .map(([groupName, permissions]) => {
      const sortedPermissions = permissions
        .map((permission) => ({
          code: permission.permissionGroupCode,
          name: permission.name
        }))
        .sort((a, b) => getCodeValue(a.code) - getCodeValue(b.code))

      const order = sortedPermissions.length > 0 ? getCodeValue(sortedPermissions[0].code) : Number.MAX_SAFE_INTEGER

      return {
        featureGroup: groupName,
        permissions: sortedPermissions,
        order
      }
    })
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }
      return a.featureGroup.localeCompare(b.featureGroup)
    })
    .map(({ order, ...group }) => group)
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

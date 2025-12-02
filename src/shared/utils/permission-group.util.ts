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

export const mapPermissionGroups = <T extends PermissionGroupDisplayRecord>(items: T[]): PermissionGroupDisplay[] => {
  // Group theo groupName
  const groupsByName = groupBy(items, 'groupName')

  const parseOrderFromCode = (code: string): number => {
    const numeric = parseInt(code.replace(/\D/g, ''), 10)
    return Number.isNaN(numeric) ? Number.MAX_SAFE_INTEGER : numeric
  }

  const groupsWithOrder = Object.entries(groupsByName).map(([groupName, records]) => {
    // Chuẩn hóa và sort permission trong group
    const permissions = records
      .map((record) => ({
        code: record.permissionGroupCode,
        name: record.name
      }))
      .sort((a, b) => parseOrderFromCode(a.code) - parseOrderFromCode(b.code))

    // Thứ tự của group = thứ tự nhỏ nhất trong các code của group
    const order = permissions.length > 0 ? parseOrderFromCode(permissions[0].code) : Number.MAX_SAFE_INTEGER

    return {
      featureGroup: groupName,
      permissions,
      order
    }
  })

  const sortedGroups = groupsWithOrder
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }
      return a.featureGroup.localeCompare(b.featureGroup)
    })
    .map(({ order, ...rest }) => rest)

  return sortedGroups
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

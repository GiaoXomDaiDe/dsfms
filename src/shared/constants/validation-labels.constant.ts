export const ValidationFieldLabels: Record<string, string> = {
  role: 'Role information',
  'role.id': 'Role ID',
  'role.name': 'Role name'
}

export function getFieldLabel(path: string): string | undefined {
  return ValidationFieldLabels[path]
}

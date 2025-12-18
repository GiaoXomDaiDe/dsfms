import { RoleName, type RoleNameType } from '~/shared/constants/auth.constant'
import { DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES } from '~/shared/constants/permission.constant'
import { ACADEMIC_DEPARTMENT_DEFAULT_ENDPOINT_PERMISSION_NAMES } from './academic-department-role-permissions.constant'
import { ADMINISTRATOR_DEFAULT_ENDPOINT_PERMISSION_NAMES } from './administrator-role-permissions.constant'
import { DEPARTMENT_HEAD_DEFAULT_ENDPOINT_PERMISSION_NAMES } from './department-head-role-permissions.constant'
import { SQA_AUDITOR_DEFAULT_ENDPOINT_PERMISSION_NAMES } from './sqa-auditor-role-permissions.constant'
import { TRAINEE_DEFAULT_ENDPOINT_PERMISSION_NAMES } from './trainee-role-permissions.constant'
import { TRAINER_DEFAULT_ENDPOINT_PERMISSION_NAMES } from './trainer-role-permissions.constant'

export const ROLE_DEFAULT_PERMISSION_NAME_MAP: Record<RoleNameType, readonly string[]> = {
  [RoleName.ADMINISTRATOR]: ADMINISTRATOR_DEFAULT_ENDPOINT_PERMISSION_NAMES,
  [RoleName.TRAINEE]: TRAINEE_DEFAULT_ENDPOINT_PERMISSION_NAMES,
  [RoleName.TRAINER]: TRAINER_DEFAULT_ENDPOINT_PERMISSION_NAMES,
  [RoleName.ACADEMIC_DEPARTMENT]: ACADEMIC_DEPARTMENT_DEFAULT_ENDPOINT_PERMISSION_NAMES,
  [RoleName.DEPARTMENT_HEAD]: DEPARTMENT_HEAD_DEFAULT_ENDPOINT_PERMISSION_NAMES,
  [RoleName.SQA_AUDITOR]: SQA_AUDITOR_DEFAULT_ENDPOINT_PERMISSION_NAMES
}

export const getDefaultPermissionNamesForRole = (roleName: string): string[] => {
  const defaults = ROLE_DEFAULT_PERMISSION_NAME_MAP[roleName as RoleNameType]
  return defaults
    ? [...DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES, ...defaults]
    : [...DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES]
}

import { DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES } from '~/shared/constants/permission.constant'

// Add trainer-specific default permissions (e.g., teaching dashboards) here.
export const TRAINER_DEFAULT_ENDPOINT_PERMISSION_NAMES: readonly string[] = [...DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES]

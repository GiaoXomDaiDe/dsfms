import { DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES } from '~/shared/constants/permission.constant'

// Add trainee-specific default permissions (e.g., trainee dashboard) here.
export const TRAINEE_DEFAULT_ENDPOINT_PERMISSION_NAMES: readonly string[] = [...DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES]

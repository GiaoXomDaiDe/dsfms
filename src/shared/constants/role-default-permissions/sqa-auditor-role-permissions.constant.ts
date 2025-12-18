import { DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES } from '~/shared/constants/permission.constant'

// Add SQA auditor-specific default permissions here.
export const SQA_AUDITOR_DEFAULT_ENDPOINT_PERMISSION_NAMES: readonly string[] = [
  ...DEFAULT_ROLE_ENDPOINT_PERMISSION_NAMES,
  'POST /templates/parse'
]

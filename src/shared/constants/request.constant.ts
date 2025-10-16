export const RequestType = {
  SAFETY_REPORT: 'SAFETY_REPORT',
  INCIDENT_REPORT: 'INCIDENT_REPORT',
  FEEDBACK_REPORT: 'FEEDBACK_REPORT',
  ASSESSMENT_APPROVAL_REQUEST: 'ASSESSMENT_APPROVAL_REQUEST'
} as const

export const RequestSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
} as const

export const RequestStatus = {
  CREATED: 'CREATED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
} as const

export type RequestTypeValue = (typeof RequestType)[keyof typeof RequestType]
export type RequestSeverityValue = (typeof RequestSeverity)[keyof typeof RequestSeverity]
export type RequestStatusValue = (typeof RequestStatus)[keyof typeof RequestStatus]

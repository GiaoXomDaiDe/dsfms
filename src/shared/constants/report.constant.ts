export const ReportType = {
  SAFETY_REPORT: 'SAFETY_REPORT',
  INSTRUCTOR_REPORT: 'INSTRUCTOR_REPORT',
  FATIGUE_REPORT: 'FATIGUE_REPORT',
  TRAINING_PROGRAM_REPORT: 'TRAINING_PROGRAM_REPORT',
  FACILITIES_REPORT: 'FACILITIES_REPORT',
  COURSE_ORGANIZATION_REPORT: 'COURSE_ORGANIZATION_REPORT',
  FEEDBACK: 'FEEDBACK',
  OTHER: 'OTHER'
} as const

export const ReportSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
} as const

export const ReportStatus = {
  SUBMITTED: 'SUBMITTED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED'
} as const

export type ReportTypeValue = (typeof ReportType)[keyof typeof ReportType]
export type ReportSeverityValue = (typeof ReportSeverity)[keyof typeof ReportSeverity]
export type ReportStatusValue = (typeof ReportStatus)[keyof typeof ReportStatus]

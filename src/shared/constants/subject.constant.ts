export const SubjectMethod = {
  E_LEARNING: 'E_LEARNING',
  CLASSROOM: 'CLASSROOM',
  ERO: 'ERO'
} as const

export const SubjectType = {
  UNLIMIT: 'UNLIMIT',
  RECURRENT: 'RECURRENT'
} as const

export const SubjectStatus = {
  PLANNED: 'PLANNED',
  ON_GOING: 'ON_GOING',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED'
} as const

export const SubjectInstructorRole = {
  PRIMARY_INSTRUCTOR: 'PRIMARY_INSTRUCTOR',
  EXAMINER: 'EXAMINER',
  ASSISTANT_INSTRUCTOR: 'ASSISTANT_INSTRUCTOR',
  ASSESSMENT_REVIEWER: 'ASSESSMENT_REVIEWER'
} as const

export const SubjectEnrollmentStatus = {
  ENROLLED: 'ENROLLED',
  ON_GOING: 'ON_GOING',
  CANCELLED: 'CANCELLED',
  FINISHED: 'FINISHED'
} as const

export type SubjectMethodValue = (typeof SubjectMethod)[keyof typeof SubjectMethod]
export type SubjectTypeValue = (typeof SubjectType)[keyof typeof SubjectType]
export type SubjectStatusValue = (typeof SubjectStatus)[keyof typeof SubjectStatus]
export type SubjectInstructorRoleValue = (typeof SubjectInstructorRole)[keyof typeof SubjectInstructorRole]
export type SubjectEnrollmentStatusValue = (typeof SubjectEnrollmentStatus)[keyof typeof SubjectEnrollmentStatus]

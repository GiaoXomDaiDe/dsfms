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

export type SubjectMethodValue = (typeof SubjectMethod)[keyof typeof SubjectMethod]
export type SubjectTypeValue = (typeof SubjectType)[keyof typeof SubjectType]
export type SubjectStatusValue = (typeof SubjectStatus)[keyof typeof SubjectStatus]

import z from 'zod'
import { SubjectInstructorRole, SubjectMethod, SubjectStatus, SubjectType } from '~/shared/constants/subject.constant'
import {
  createEnumSchema,
  nullableNumberField,
  nullableStringField,
  requiredText
} from '~/shared/helpers/zod-validation.helper'

const SUBJECT_METHOD_ERROR_MESSAGE = `Subject method must be one of: ${[
  SubjectMethod.CLASSROOM,
  SubjectMethod.ERO,
  SubjectMethod.E_LEARNING
].join(', ')}`
const SUBJECT_TYPE_ERROR_MESSAGE = `Subject type must be one of: ${[SubjectType.RECURRENT, SubjectType.UNLIMIT].join(
  ', '
)}`
const SUBJECT_STATUS_ERROR_MESSAGE = `Subject status must be one of: ${[
  SubjectStatus.PLANNED,
  SubjectStatus.ON_GOING,
  SubjectStatus.COMPLETED,
  SubjectStatus.ARCHIVED
].join(', ')}`
const SUBJECT_INSTRUCTOR_ROLE_ERROR_MESSAGE = `Subject instructor role must be one of: ${[
  SubjectInstructorRole.ASSESSMENT_REVIEWER,
  SubjectInstructorRole.EXAMINER
].join(', ')}`

export const subjectNameSchema = requiredText({
  field: 'Subject name',
  max: 255
})

export const subjectCodeSchema = requiredText({
  field: 'Subject code',
  max: 50
})

export const subjectDescriptionSchema = nullableStringField(
  z.string().max(1000, 'Subject description must not exceed 1000 characters')
)

export const subjectRemarkSchema = nullableStringField(
  z.string().max(1000, 'Subject remark must not exceed 1000 characters')
)

export const subjectRoomNameSchema = nullableStringField(
  z.string().max(255, 'Room name must not exceed 255 characters')
)

export const subjectTimeSlotSchema = nullableStringField(
  z.string().max(255, 'Time slot must not exceed 255 characters')
)

export const subjectDurationSchema = nullableNumberField(z.number())

export const subjectPassScoreSchema = nullableNumberField(
  z
    .number()
    .min(0, 'Subject pass score must be greater than or equal to 0')
    .max(100, 'Subject pass score must not exceed 100')
)

export const subjectMethodSchema = createEnumSchema(
  [SubjectMethod.CLASSROOM, SubjectMethod.ERO, SubjectMethod.E_LEARNING],
  SUBJECT_METHOD_ERROR_MESSAGE
)

export const subjectTypeSchema = createEnumSchema(
  [SubjectType.RECURRENT, SubjectType.UNLIMIT],
  SUBJECT_TYPE_ERROR_MESSAGE
)

export const subjectStatusSchema = createEnumSchema(
  [SubjectStatus.PLANNED, SubjectStatus.ON_GOING, SubjectStatus.COMPLETED, SubjectStatus.ARCHIVED],
  SUBJECT_STATUS_ERROR_MESSAGE
)

export const subjectInstructorRoleSchema = createEnumSchema(
  [SubjectInstructorRole.ASSESSMENT_REVIEWER, SubjectInstructorRole.EXAMINER],
  SUBJECT_INSTRUCTOR_ROLE_ERROR_MESSAGE
)

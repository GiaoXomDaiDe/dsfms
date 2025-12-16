import z from 'zod'
import {
  BASIC_TEXT_REGEX,
  CODE_TEXT_REGEX,
  COUNTRY_REGEX,
  PASSPORT_REGEX
} from '~/shared/constants/validation.constant'
import {
  isoDatetimeSchema,
  nullableNumberField,
  optionalText,
  requiredText
} from '~/shared/helpers/zod-validation.helper'

const SPECIALIZATION_MESSAGE = 'Specialization may only contain letters, numbers, spaces, and common punctuation'
const CERTIFICATION_MESSAGE =
  'Certification number may only contain letters, numbers, spaces, dash, slash, or underscore'
const BIO_MESSAGE = 'Bio contains unsupported characters'
const TRAINING_BATCH_MESSAGE = 'Training batch may only contain letters, numbers, spaces, dash, slash, or underscore'
const PASSPORT_MESSAGE = 'Passport number may only contain letters, numbers, spaces, or hyphen'
const NATION_MESSAGE = 'Nation may only contain alphabetic characters and separators'

export const trainerSpecializationSchema = requiredText({
  field: 'Specialization',
  max: 100,
  options: {
    pattern: BASIC_TEXT_REGEX,
    message: SPECIALIZATION_MESSAGE
  }
})

export const trainerCertificationNumberSchema = requiredText({
  field: 'Certification number',
  max: 50,
  options: {
    pattern: CODE_TEXT_REGEX,
    message: CERTIFICATION_MESSAGE
  }
})

export const trainerYearsOfExperienceSchema = nullableNumberField(
  z
    .number()
    .int('Years of experience must be a whole number')
    .min(0, 'Years of experience cannot be negative')
    .max(50, 'Years of experience cannot exceed 50 years'),
  { coerceInteger: true }
).default(0)

export const traineeTrainingBatchSchema = requiredText({
  field: 'Training batch',
  max: 100,
  options: {
    pattern: CODE_TEXT_REGEX,
    message: TRAINING_BATCH_MESSAGE
  }
})

export const traineePassportSchema = requiredText({
  field: 'Passport number',
  max: 100,
  options: {
    pattern: PASSPORT_REGEX,
    message: PASSPORT_MESSAGE
  }
})

export const traineeNationSchema = optionalText({
  field: 'Nation',
  max: 100,
  options: {
    pattern: COUNTRY_REGEX,
    message: NATION_MESSAGE
  }
})

const INVALID_DOB_MESSAGE = 'Date of birth must be a valid date'
const FUTURE_DOB_MESSAGE = 'Date of birth cannot be in the future'

export const traineeDobSchema = isoDatetimeSchema.superRefine((date, ctx) => {
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: 'custom', message: INVALID_DOB_MESSAGE })
  } else if (date.getTime() > Date.now()) {
    ctx.addIssue({ code: 'custom', message: FUTURE_DOB_MESSAGE })
  }
})

export const traineeEnrollmentDateSchema = isoDatetimeSchema.nullable().optional()

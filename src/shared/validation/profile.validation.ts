import z from 'zod'
import {
  isoDatetimeSchema,
  nullableNumberField,
  optionalText,
  requiredText
} from '~/shared/helpers/zod-validation.helper'

export const trainerSpecializationSchema = requiredText({
  field: 'Specialization',
  max: 100
})

export const trainerCertificationNumberSchema = requiredText({
  field: 'Certification number',
  max: 50
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
  max: 100
})

export const traineePassportSchema = requiredText({
  field: 'Passport number',
  max: 100
})

export const traineeNationSchema = optionalText({
  field: 'Nation',
  max: 100
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

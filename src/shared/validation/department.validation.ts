import z from 'zod'
import { nullableStringField, requiredText } from '~/shared/helpers/zod-validation.helper'

// Department name: required, max 255 chars, no regex constraint
export const departmentNameSchema = requiredText({
  field: 'Department name',
  max: 255
})

// Department code: required, max 50 chars, no regex constraint
export const departmentCodeSchema = requiredText({
  field: 'Department code',
  max: 50
})

// Department description: nullable, max 1000 chars, no regex/alpha requirement
export const departmentDescriptionSchema = nullableStringField(z.string().max(1000))

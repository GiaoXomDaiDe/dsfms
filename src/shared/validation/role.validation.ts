import z from 'zod'
import { nullableStringField, requiredText } from '~/shared/helpers/zod-validation.helper'

// roleNameSchema: required, max 500 chars, no regex constraint
export const roleNameSchema = requiredText({
  field: 'Role name',
  max: 500
})

// roleDescriptionSchema: nullable, max 500 chars, no regex constraint
export const roleDescriptionSchema = nullableStringField(z.string().max(500))

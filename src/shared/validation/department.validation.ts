import z from 'zod'
import { BASIC_TEXT_REGEX, CODE_TEXT_REGEX } from '~/shared/constants/validation.constant'
import { nullableStringField, optionalAlphabeticCharacter, requiredText } from '~/shared/helpers/zod-validation.helper'

const DEPARTMENT_NAME_MESSAGE = 'Department name invalid'
const DEPARTMENT_CODE_MESSAGE = 'Department code invalid'
const DEPARTMENT_DESCRIPTION_MESSAGE = 'Department description invalid'

export const departmentNameSchema = requiredText({
  field: 'Department name',
  max: 255,
  options: {
    pattern: BASIC_TEXT_REGEX,
    message: DEPARTMENT_NAME_MESSAGE
  }
})

export const departmentCodeSchema = requiredText({
  field: 'Department code',
  max: 50,
  options: {
    pattern: CODE_TEXT_REGEX,
    message: DEPARTMENT_CODE_MESSAGE
  }
})

export const departmentDescriptionSchema = nullableStringField(z.string().max(1000)).refine(
  optionalAlphabeticCharacter,
  {
    message: DEPARTMENT_DESCRIPTION_MESSAGE
  }
)

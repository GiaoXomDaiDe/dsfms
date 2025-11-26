import z from 'zod'
import { NAME_REGEX } from '~/shared/constants/validation.constant'
import { optionalAlphabeticCharacter, requiredText } from '~/shared/helpers/zod-validation.helper'

const ROLE_NAME_MESSAGE = 'Role name invalid'
const ROLE_DESCRIPTION_MESSAGE = 'Description invalid'

// roleNameSchema: bắt buộc nhập, tối đa 500 ký tự và hỗ trợ tên Unicode có chữ + dấu câu thông dụng
export const roleNameSchema = requiredText({
  field: 'Role name',
  max: 500,
  options: {
    pattern: NAME_REGEX,
    message: ROLE_NAME_MESSAGE,
    requiredMessage: ROLE_NAME_MESSAGE
  }
})

// roleDescriptionSchema: cho phép null, nhưng nếu có nội dung thì vẫn phải chứa ít nhất một ký tự chữ
export const roleDescriptionSchema = z.string().trim().max(500).nullable().refine(optionalAlphabeticCharacter, {
  message: ROLE_DESCRIPTION_MESSAGE
})

import z from 'zod'
import { GenderStatus, UserStatus } from '~/shared/constants/auth.constant'
import { PHONE_NUMBER_REGEX } from '~/shared/constants/validation.constant'
import {
  createEnumSchema,
  normalizeWhitespace,
  nullableStringField,
  requiredText
} from '~/shared/helpers/zod-validation.helper'

const PHONE_NUMBER_MESSAGE = 'Phone number must contain digits only'
const STATUS_ERROR_MESSAGE = `Status must be one of: ${[UserStatus.ACTIVE, UserStatus.DISABLED].join(', ')}`
const GENDER_ERROR_MESSAGE = `Gender must be one of: ${[GenderStatus.MALE, GenderStatus.FEMALE].join(', ')}`

const baseNameSchema = requiredText({
  field: 'Name',
  max: 100
})

const normalizedNameSchema = z
  .string()
  .transform((value) => normalizeWhitespace(value))
  .pipe(baseNameSchema)

/**
 * userNameSchema: chuẩn hóa khoảng trắng rồi đảm bảo tên chứa ký tự chữ hợp lệ (Unicode + dấu câu cho phép)
 */
export const userNameSchema = normalizedNameSchema

/**
 * userMiddleNameSchema: cho phép null; nếu nhập toàn khoảng trắng sẽ tự chuyển thành null,
 * còn dữ liệu khác phải thoả điều kiện như first/last name
 */
export const userMiddleNameSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return value
  }

  if (typeof value !== 'string') {
    return value
  }

  const trimmed = normalizeWhitespace(value)

  // Empty middle name should be treated as undefined so DB can default to null
  return trimmed.length === 0 ? undefined : trimmed
}, normalizedNameSchema.optional().nullable())

/** userAddressSchema: tối đa 255 ký tự, tự đổi chuỗi rỗng thành null để tránh lưu empty string */
export const userAddressSchema = nullableStringField(z.string().max(255))

/**
 * userPhoneNumberSchema: số điện thoại 9-15 ký tự và chỉ chứa chữ số, có thể để trống
 */
export const userPhoneNumberSchema = nullableStringField(
  z.string().min(9).max(15).regex(PHONE_NUMBER_REGEX, PHONE_NUMBER_MESSAGE)
)

/** userStatusSchema: đảm bảo status nằm trong danh sách ACTIVE/DISABLED */
export const userStatusSchema = createEnumSchema([UserStatus.ACTIVE, UserStatus.DISABLED], STATUS_ERROR_MESSAGE)

/** userGenderSchema: đảm bảo gender chỉ nhận MALE hoặc FEMALE */
export const userGenderSchema = createEnumSchema([GenderStatus.MALE, GenderStatus.FEMALE], GENDER_ERROR_MESSAGE)

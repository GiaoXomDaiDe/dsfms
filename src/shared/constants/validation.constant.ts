import z from 'zod'

// Cho phép mọi ký tự chữ (Letter) theo chuẩn Unicode
export const LETTER_REGEX = /\p{L}/u

// Cho phép chữ cái, dấu câu thông dụng và khoảng trắng (dùng cho tên)
export const NAME_ALLOWED_CHARS_REGEX = /^[\p{L}\p{P}\s]+$/u

// Kiểm tra chuỗi có chứa ít nhất một ký tự chữ hay không
export const NAME_CONTAINS_LETTER_REGEX = LETTER_REGEX

// Cho phép chữ, số, khoảng trắng và một số ký tự dấu phổ biến trong mô tả
export const BASIC_TEXT_REGEX = /^[\p{L}\p{N}\s.,'’\-_/()]+$/u

// Cho phép chữ, số, khoảng trắng, gạch ngang, gạch dưới và dấu slash (dùng cho mã)
export const CODE_TEXT_REGEX = /^[\p{L}\p{N}\s\-_/]+$/u

// Cho phép chữ, số, khoảng trắng và dấu gạch ngang (dùng cho số hộ chiếu)
export const PASSPORT_REGEX = /^[\p{L}\p{N}\s-]+$/u

// Cho phép tên quốc gia với chữ cái và các dấu phân cách đơn giản
export const COUNTRY_REGEX = /^[\p{L}\s'.-]+$/u

// Cho phép tên role chỉ gồm chữ cái tiếng Anh và khoảng trắng
export const ROLE_NAME_REGEX = /^[A-Za-z\s]+$/

export type TextSchemaOptions = {
  pattern?: RegExp
  message?: string
  requiredMessage?: string
  maxMessage?: string
}

export const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

export const requiredText = (field: string, max: number, options: TextSchemaOptions = {}) => {
  const requiredMessage = options.requiredMessage ?? `${field} is required`
  const maxMessage = options.maxMessage ?? `${field} must not exceed ${max} characters`

  let schema = z.string().trim().min(1, requiredMessage).max(max, maxMessage)

  if (options.pattern) {
    schema = schema.regex(options.pattern, options.message ?? `${field} contains invalid characters`)
  }

  return schema
}

export const optionalText = (field: string, max: number, options: TextSchemaOptions = {}) =>
  requiredText(field, max, options).optional().nullable().default(null)

export const hasAlphabeticCharacter = (value: string) => LETTER_REGEX.test(value)

export const optionalAlphabeticCharacter = (value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return true
  }

  const normalized = value.trim()

  return normalized.length === 0 || hasAlphabeticCharacter(normalized)
}

import z from 'zod'
import { LETTER_REGEX } from '~/shared/constants/validation.constant'

export type TextSchemaOptions = {
  pattern?: RegExp
  message?: string
  requiredMessage?: string
  maxMessage?: string
}

type RequiredTextArgs = {
  field: string
  max: number
  options?: TextSchemaOptions
}

type OptionalTextArgs = RequiredTextArgs

/** Gom nhiều khoảng trắng liên tiếp thành một dấu cách và trim hai đầu. */
export const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

type NullableStringOptions = {
  acceptUndefined?: boolean
}

/**
 * Chuẩn hoá input string cho các field nullable: trim, chuyển chuỗi rỗng thành null,
 * và tuỳ chọn cho phép undefined (được giữ nguyên) để phù hợp với payload thiếu field.
 */
export const nullableStringField = <T extends z.ZodTypeAny>(
  schema: T,
  { acceptUndefined = true }: NullableStringOptions = {}
) => {
  const target = acceptUndefined ? z.union([schema, z.null(), z.undefined()]) : z.union([schema, z.null()])

  return z.preprocess((value) => {
    if (value === undefined) {
      return acceptUndefined ? undefined : value
    }

    if (value === null) {
      return null
    }

    if (typeof value !== 'string') {
      return value
    }

    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  }, target)
}

/** Tạo schema enum với thông báo lỗi tuỳ chỉnh, dùng lại cho các trường enum đơn giản. */
export const createEnumSchema = <T extends [string, ...string[]]>(values: T, errorMessage: string) =>
  z.enum(values, {
    error: () => ({
      message: errorMessage
    })
  })

/** Tạo schema chuỗi bắt buộc với regex và thông báo tuỳ chỉnh (nếu cần). */
export const requiredText = ({ field, max, options = {} }: RequiredTextArgs) => {
  const requiredMessage = options.requiredMessage ?? `${field} is required`
  const maxMessage = options.maxMessage ?? `${field} must not exceed ${max} characters`

  let schema = z.string().trim().min(1, requiredMessage).max(max, maxMessage)

  if (options.pattern) {
    schema = schema.regex(options.pattern, options.message ?? `${field} contains invalid characters`)
  }

  return schema
}

/** Dựa trên requiredText nhưng cho phép null/undefined và tự động trả về null. */
export const optionalText = ({ field, max, options }: OptionalTextArgs) =>
  requiredText({ field, max, options }).optional().nullable().default(null)

/** Kiểm tra chuỗi có chứa ít nhất một ký tự chữ hay không. */
export const hasAlphabeticCharacter = (value: string) => LETTER_REGEX.test(value)

/**
 * Dùng cho các field mô tả optional: nếu bỏ trống thì pass, còn nếu nhập thì
 * chuỗi phải chứa ít nhất một ký tự chữ (tránh nhập toàn số hoặc ký tự đặc biệt).
 */
export const optionalAlphabeticCharacter = (value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return true
  }

  const normalized = normalizeWhitespace(value)

  return normalized.length === 0 || hasAlphabeticCharacter(normalized)
}

const coerceToIsoDatetimeString = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}

const truncateToUtcMidnight = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

/** Chuyển chuỗi/Date ISO datetime thành Date nguyên thuỷ. */
export const isoDatetimeSchema = z
  .preprocess(coerceToIsoDatetimeString, z.iso.datetime())
  .transform((value) => new Date(value))

/** Chuyển chuỗi/Date thành Date với phần thời gian được đưa về 00:00:00 UTC. */
export const isoDateSchema = z.coerce.date().transform((value) => truncateToUtcMidnight(value))

/** URL hợp lệ: chấp nhận null hoặc chuỗi rỗng (được chuyển thành null) */
export const urlSchema = nullableStringField(z.url())

/** UUID hợp lệ: chấp nhận null hoặc chuỗi rỗng (được chuyển thành null) */
export const nullableUuidSchema = nullableStringField(z.uuid())

type NullableNumberOptions = {
  acceptUndefined?: boolean
  coerceInteger?: boolean
}

/**
 * Chuẩn hoá input number: chấp nhận string/number/null/undefined, trim chuỗi, chuyển rỗng thành null,
 * và optional ép kiểu integer.
 */
export const nullableNumberField = (
  schema: z.ZodNumber,
  { acceptUndefined = true, coerceInteger = false }: NullableNumberOptions = {}
) => {
  const target = acceptUndefined ? z.union([schema, z.null(), z.undefined()]) : z.union([schema, z.null()])

  return z.preprocess((value) => {
    if (value === undefined) {
      return acceptUndefined ? undefined : value
    }

    if (value === null) {
      return null
    }

    const normalizeNumber = (numericValue: number) =>
      coerceInteger ? (Number.isNaN(numericValue) ? numericValue : Math.trunc(numericValue)) : numericValue

    if (typeof value === 'number') {
      return normalizeNumber(value)
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        return null
      }

      const parsed = Number(trimmed)
      return Number.isNaN(parsed) ? value : normalizeNumber(parsed)
    }

    return value
  }, target)
}

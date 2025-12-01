import { createZodValidationPipe, ZodValidationPipe } from 'nestjs-zod'
import { ZodError } from 'zod'
import { getFieldLabel } from '~/shared/constants/validation-labels.constant'
import { ValidationException } from '~/shared/exceptions/validation.exception'

const CustomZodValidationPipe: typeof ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    const errors = error.issues.map((err) => ({
      field: err.path.join('.') || 'payload',
      message: formatErrorMessage(err),
      code: err.code
    }))

    return new ValidationException(
      errors.map(({ field, message, ...rest }) => ({
        path: field,
        message,
        ...rest
      })),
      'Validation failed'
    )
  }
})

function formatErrorMessage(error: any): string {
  const path = error.path.join('.') || 'payload'
  const field = getFieldLabel(path) ?? humanize(path)

  switch (error.code) {
    case 'invalid_type':
      if (error.received === 'undefined') {
        return `${field} is required.`
      }
      return `${field} must be ${describeType(error.expected)}.`

    case 'invalid_string':
      if (error.validation === 'uuid') {
        return `${field} needs to be a valid UUID.`
      }
      if (error.validation === 'email') {
        return `${field} should look like an email address (name@example.com).`
      }
      return `${field} is not formatted correctly.`

    case 'invalid_enum_value':
      if (Array.isArray(error.options)) {
        return `${field} must be one of: ${error.options.join(', ')}.`
      }
      return `${field} is not an allowed value.`

    case 'too_small':
      if (error.type === 'string') {
        return `${field} needs at least ${error.minimum} characters.`
      }
      if (error.type === 'array') {
        return `${field} should include at least ${error.minimum} item(s).`
      }
      return `${field} must be greater than or equal to ${error.minimum}.`

    case 'too_big':
      if (error.type === 'string') {
        return `${field} should not exceed ${error.maximum} characters.`
      }
      if (error.type === 'array') {
        return `${field} should not have more than ${error.maximum} item(s).`
      }
      return `${field} must be less than or equal to ${error.maximum}.`

    case 'unrecognized_keys': {
      const keys = Array.isArray(error.keys) ? error.keys.join(', ') : 'an unknown field'
      return `${field} has unexpected field: ${keys}.`
    }

    default:
      return error.message ?? `${field} is invalid.`
  }
}

function humanize(path: string): string {
  if (!path || path === 'payload') {
    return 'Payload'
  }

  return path
    .split('.')
    .map((segment) =>
      segment
        .replace(/\[(\d+)\]/g, ' $1')
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .trim()
    )
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function describeType(expected: string | undefined): string {
  if (!expected) return 'a valid value'
  if (expected === 'string') return 'text'
  if (expected === 'number') return 'a number'
  if (expected === 'boolean') return 'true or false'
  return expected
}

export default CustomZodValidationPipe

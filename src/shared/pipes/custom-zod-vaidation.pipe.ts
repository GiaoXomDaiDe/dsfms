import { UnprocessableEntityException } from '@nestjs/common'
import { createZodValidationPipe, ZodValidationPipe } from 'nestjs-zod'
import { ZodError } from 'zod'

const CustomZodValidationPipe: typeof ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    // Format errors properly
    const errors = error.issues.map((err) => ({
      field: err.path.join('.'),
      message: formatErrorMessage(err),
      code: err.code
    }))

    // Return with proper structure
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: errors
    })
  }
})

function formatErrorMessage(error: any): string {
  const field = error.path.join('.')

  switch (error.code) {
    case 'invalid_type':
      if (error.received === 'undefined') {
        return `${field} is required`
      }
      return `${field} must be ${error.expected}`

    case 'invalid_string':
      if (error.validation === 'uuid') {
        return `${field} must be a valid UUID`
      }
      if (error.validation === 'email') {
        return `${field} must be a valid email`
      }
      return `Invalid ${field}`

    case 'too_small':
      if (error.type === 'string') {
        return `${field} must be at least ${error.minimum} characters`
      }
      return `${field} must be at least ${error.minimum}`

    case 'too_big':
      if (error.type === 'string') {
        return `${field} must not exceed ${error.maximum} characters`
      }
      return `${field} must not exceed ${error.maximum}`

    default:
      return error.message
  }
}

export default CustomZodValidationPipe

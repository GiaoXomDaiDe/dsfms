import { HttpStatus, UnprocessableEntityException } from '@nestjs/common'

export type ValidationErrorItem = {
  message: string
  path?: string
  [key: string]: unknown
}

export class ValidationException extends UnprocessableEntityException {
  constructor(errors: ValidationErrorItem[] | ValidationErrorItem, message = 'Validation failed') {
    super({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: 'Unprocessable Entity',
      message,
      errors: Array.isArray(errors) ? errors : [errors]
    })
  }
}

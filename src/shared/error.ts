import { ValidationException } from '~/shared/exceptions/validation.exception'

export const InvalidPasswordException = new ValidationException([
  {
    message: 'Invalid password',
    path: 'password'
  }
])

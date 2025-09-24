import { UnprocessableEntityException } from '@nestjs/common'

export const InvalidPasswordException = new UnprocessableEntityException([
  {
    message: 'Invalid password',
    path: 'password'
  }
])

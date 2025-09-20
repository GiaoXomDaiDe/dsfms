import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'

export const NotFoundPermissionException = new NotFoundException('Permission not found')

export const PermissionAlreadyExistsException = new UnprocessableEntityException([
  {
    path: 'path',
    message: 'Permission path must be unique'
  },
  {
    path: 'method',
    message: 'Permission method must be unique'
  }
])

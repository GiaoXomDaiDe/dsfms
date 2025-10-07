import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common'

export const UserAlreadyExistsException = new UnprocessableEntityException([
  {
    message: 'User already exists',
    path: 'email'
  }
])

export const UserNotFoundException = new NotFoundException({
  message: 'User not found',
  error: 'USER_NOT_FOUND'
})

export const CannotUpdateAdminUserException = new ForbiddenException('Cannot update admin user')

export const CannotDeleteAdminUserException = new ForbiddenException('Cannot delete admin user')

// Chỉ Admin mới có thể đặt role là ADMIN
export const CannotSetAdminRoleToUserException = new ForbiddenException('Cannot set admin role to user')

export const RoleNotFoundException = new UnprocessableEntityException([
  {
    message: 'Role not found',
    path: 'roleId'
  }
])

// Không thể xóa hoặc cập nhật chính bản thân mình
export const CannotUpdateOrDeleteYourselfException = new ForbiddenException('Cannot update or delete yourself')

export const UserIsNotDisabledException = new BadRequestException('User is not disabled')

export class BulkUserCreationException extends BadRequestException {
  constructor(message: string, details?: any) {
    super({
      message: message,
      error: 'BULK_CREATION_ERROR',
      details: details
    })
  }
}

export const DefaultRoleValidationException = new BadRequestException({
  message: 'Role validation failed',
  error: 'ROLE_VALIDATION_FAILED'
})

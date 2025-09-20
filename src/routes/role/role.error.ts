import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'

export const RoleAlreadyExistsException = new UnprocessableEntityException([
  {
    message: 'Role already exists',
    path: 'name'
  }
])

export const ProhibitedActionOnBaseRoleException = new ForbiddenException('Prohibited action on base role')

export const NotFoundRoleException = new NotFoundException('Role not found')

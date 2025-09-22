import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { RoleWithPermissionsType } from '~/routes/role/role.model'
import { REQUEST_ROLE_PERMISSIONS } from '~/shared/constants/auth.constant'

export const ActiveRolePermissions = createParamDecorator(
  (field: keyof RoleWithPermissionsType | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest()
    const rolePermissions: RoleWithPermissionsType | undefined = request[REQUEST_ROLE_PERMISSIONS]
    return field ? rolePermissions?.[field] : rolePermissions
  }
)

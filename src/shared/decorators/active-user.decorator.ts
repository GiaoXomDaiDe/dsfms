import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { REQUEST_USER_KEY } from '~/shared/constants/auth.constant'
import { AccessTokenPayload } from '~/shared/types/jwt.types'

export const ActiveUser = createParamDecorator((field: keyof AccessTokenPayload | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()
  const user: AccessTokenPayload | undefined = request[REQUEST_USER_KEY]
  return field ? user?.[field] : user
})

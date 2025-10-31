import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import { EXCLUDE_PERMISSION_MODULES_KEY } from '~/shared/constants/auth.constant'

export const ExcludePermissionModules = (...moduleNames: string[]) =>
  SetMetadata(EXCLUDE_PERMISSION_MODULES_KEY, moduleNames)

export const ExcludedPermissionModules = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const handlerModules = (Reflect.getMetadata(EXCLUDE_PERMISSION_MODULES_KEY, context.getHandler()) ?? []) as string[]
  const classModules = (Reflect.getMetadata(EXCLUDE_PERMISSION_MODULES_KEY, context.getClass()) ?? []) as string[]
  const merged = [...classModules, ...handlerModules].filter((moduleName) => typeof moduleName === 'string')
  return Array.from(new Set(merged.map((moduleName) => moduleName.trim()))).filter(
    (moduleName) => moduleName.length > 0
  )
})

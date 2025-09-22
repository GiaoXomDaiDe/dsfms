import { createZodDto } from 'nestjs-zod'
import {
  CreateUserBodySchema,
  CreateUserBodyWithProfileSchema,
  GetUserParamsSchema,
  GetUserProfileResSchema,
  GetUsersQuerySchema,
  GetUsersResSchema,
  UpdateProfileResSchema,
  UpdateUserBodySchema
} from '~/routes/user/user.model'

export class GetUsersResDTO extends createZodDto(GetUsersResSchema) {}

export class GetUsersQueryDTO extends createZodDto(GetUsersQuerySchema) {}

export class GetUserParamsDTO extends createZodDto(GetUserParamsSchema) {}

export class CreateUserBodyDTO extends createZodDto(CreateUserBodySchema) {}

export class UpdateUserBodyDTO extends createZodDto(UpdateUserBodySchema) {}
/**
 * Áp dụng cho Response của api GET('profile') và GET('users/:userId')
 */
export class GetUserProfileResDTO extends createZodDto(GetUserProfileResSchema) {}
/**
 * Áp dụng cho Response của api PUT('profile') và PUT('users/:userId')
 */
export class UpdateProfileResDTO extends createZodDto(UpdateProfileResSchema) {}

export class CreateUserResDTO extends UpdateProfileResDTO {}

export class CreateUserBodyWithProfileDTO extends createZodDto(CreateUserBodyWithProfileSchema) {}

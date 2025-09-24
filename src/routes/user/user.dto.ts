import { createZodDto } from 'nestjs-zod'
import {
  BulkCreateResultSchema,
  CreateBulkUsersBodySchema,
  CreateUserBodySchema,
  CreateUserBodyWithProfileSchema,
  GetUserParamsSchema,
  GetUserProfileResSchema,
  GetUsersQuerySchema,
  GetUsersResSchema,
  UpdateUserBodyWithProfileSchema,
  UpdateUserResSchema
} from '~/routes/user/user.model'

export class GetUsersResDTO extends createZodDto(GetUsersResSchema) {}

export class GetUsersQueryDTO extends createZodDto(GetUsersQuerySchema) {}

export class GetUserParamsDTO extends createZodDto(GetUserParamsSchema) {}

export class CreateUserBodyDTO extends createZodDto(CreateUserBodySchema) {}

export class UpdateUserBodyWithProfileDTO extends createZodDto(UpdateUserBodyWithProfileSchema) {}

export class CreateBulkUsersBodyDTO extends createZodDto(CreateBulkUsersBodySchema) {}

export class BulkCreateResultDTO extends createZodDto(BulkCreateResultSchema) {}

/**
 * Áp dụng cho Response của api GET('profile') và GET('users/:userId')
 */
export class GetUserProfileResDTO extends createZodDto(GetUserProfileResSchema) {}
/**
 * Áp dụng cho Response của api PUT('profile') và PUT('users/:userId')
 */
export class UpdateUserResDTO extends createZodDto(UpdateUserResSchema) {}

export class CreateUserResDTO extends UpdateUserResDTO {}

export class CreateUserBodyWithProfileDTO extends createZodDto(CreateUserBodyWithProfileSchema) {}

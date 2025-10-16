import { createZodDto } from 'nestjs-zod'
import {
  CreateRequestBodySchema,
  CreateRequestResSchema,
  GetMyRequestsQuerySchema,
  GetMyRequestsResSchema,
  GetRequestParamsSchema,
  GetRequestResSchema,
  GetRequestsQuerySchema,
  GetRequestsResSchema,
  UpdateRequestStatusBodySchema,
  UpdateRequestStatusResSchema
} from '~/routes/request/request.model'

export class GetRequestsQueryDTO extends createZodDto(GetRequestsQuerySchema) {}

export class GetRequestsResDTO extends createZodDto(GetRequestsResSchema) {}

export class GetMyRequestsQueryDTO extends createZodDto(GetMyRequestsQuerySchema) {}

export class GetMyRequestsResDTO extends createZodDto(GetMyRequestsResSchema) {}

export class GetRequestParamsDTO extends createZodDto(GetRequestParamsSchema) {}

export class GetRequestResDTO extends createZodDto(GetRequestResSchema) {}

export class CreateRequestBodyDTO extends createZodDto(CreateRequestBodySchema) {}

export class CreateRequestResDTO extends createZodDto(CreateRequestResSchema) {}

export class UpdateRequestStatusBodyDTO extends createZodDto(UpdateRequestStatusBodySchema) {}

export class UpdateRequestStatusResDTO extends createZodDto(UpdateRequestStatusResSchema) {}

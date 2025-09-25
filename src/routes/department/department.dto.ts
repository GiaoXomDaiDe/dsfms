import { createZodDto } from 'nestjs-zod'
import {
  CreateDepartmentBodySchema,
  CreateDepartmentResSchema,
  GetDepartmentDetailResSchema,
  GetDepartmentParamsSchema,
  GetDepartmentsQuerySchema,
  GetDepartmentsResSchema,
  UpdateDepartmentBodySchema
} from '~/routes/department/department.model'

export class GetDepartmentsResDTO extends createZodDto(GetDepartmentsResSchema) {}

export class GetDepartmentsQueryDTO extends createZodDto(GetDepartmentsQuerySchema) {}

export class GetDepartmentParamsDTO extends createZodDto(GetDepartmentParamsSchema) {}

export class GetDepartmentDetailResDTO extends createZodDto(GetDepartmentDetailResSchema) {}

export class CreateDepartmentBodyDTO extends createZodDto(CreateDepartmentBodySchema) {}

export class CreateDepartmentResDTO extends createZodDto(CreateDepartmentResSchema) {}

export class UpdateDepartmentBodyDTO extends createZodDto(UpdateDepartmentBodySchema) {}

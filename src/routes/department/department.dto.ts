import { createZodDto } from 'nestjs-zod'
import {
  CreateDepartmentBodySchema,
  CreateDepartmentResSchema,
  GetDepartmentDetailQuerySchema,
  GetDepartmentDetailResSchema,
  GetDepartmentHeadsResSchema,
  GetDepartmentParamsSchema,
  GetDepartmentsQuerySchema,
  GetDepartmentsResSchema,
  UpdateDepartmentBodySchema,
  UpdateDepartmentEnhancedBodySchema,
  UpdateDepartmentEnhancedResSchema
} from '~/routes/department/department.model'

export class GetDepartmentsResDTO extends createZodDto(GetDepartmentsResSchema) {}

export class GetDepartmentsQueryDTO extends createZodDto(GetDepartmentsQuerySchema) {}

export class GetDepartmentParamsDTO extends createZodDto(GetDepartmentParamsSchema) {}

export class GetDepartmentDetailQueryDTO extends createZodDto(GetDepartmentDetailQuerySchema) {}

export class GetDepartmentDetailResDTO extends createZodDto(GetDepartmentDetailResSchema) {}

export class CreateDepartmentBodyDTO extends createZodDto(CreateDepartmentBodySchema) {}

export class CreateDepartmentResDTO extends createZodDto(CreateDepartmentResSchema) {}

export class UpdateDepartmentBodyDTO extends createZodDto(UpdateDepartmentBodySchema) {}

export class GetDepartmentHeadsResDTO extends createZodDto(GetDepartmentHeadsResSchema) {}

export class UpdateDepartmentEnhancedBodyDTO extends createZodDto(UpdateDepartmentEnhancedBodySchema) {}

export class UpdateDepartmentEnhancedResDTO extends createZodDto(UpdateDepartmentEnhancedResSchema) {}

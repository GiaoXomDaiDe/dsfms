import { createZodDto } from 'nestjs-zod'
import {
  AddTrainersToDepartmentBodySchema,
  AddTrainersToDepartmentParamsSchema,
  CreateDepartmentBodySchema,
  CreateDepartmentResSchema,
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

export class GetDepartmentDetailResDTO extends createZodDto(GetDepartmentDetailResSchema) {}

export class CreateDepartmentBodyDTO extends createZodDto(CreateDepartmentBodySchema) {}

export class CreateDepartmentResDTO extends createZodDto(CreateDepartmentResSchema) {}

export class UpdateDepartmentBodyDTO extends createZodDto(UpdateDepartmentBodySchema) {}

export class AddTrainersToDepartmentBodyDTO extends createZodDto(AddTrainersToDepartmentBodySchema) {}

export class AddTrainersToDepartmentParamsDTO extends createZodDto(AddTrainersToDepartmentParamsSchema) {}

export class GetDepartmentHeadsResDTO extends createZodDto(GetDepartmentHeadsResSchema) {}

export class UpdateDepartmentEnhancedBodyDTO extends createZodDto(UpdateDepartmentEnhancedBodySchema) {}

export class UpdateDepartmentEnhancedResDTO extends createZodDto(UpdateDepartmentEnhancedResSchema) {}

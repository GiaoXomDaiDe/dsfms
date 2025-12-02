import { createZodDto } from 'nestjs-zod'
import { DepartmentMes } from '~/routes/department/department.message'
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
import { createResponseDto } from '~/shared/helper'

export class GetDepartmentsQueryDTO extends createZodDto(GetDepartmentsQuerySchema) {}
export class GetDepartmentParamsDTO extends createZodDto(GetDepartmentParamsSchema) {}
export class GetDepartmentDetailQueryDTO extends createZodDto(GetDepartmentDetailQuerySchema) {}
export class CreateDepartmentBodyDTO extends createZodDto(CreateDepartmentBodySchema) {}
export class UpdateDepartmentBodyDTO extends createZodDto(UpdateDepartmentBodySchema) {}
export class UpdateDepartmentEnhancedBodyDTO extends createZodDto(UpdateDepartmentEnhancedBodySchema) {}

export class GetDepartmentsResDTO extends createResponseDto(GetDepartmentsResSchema, DepartmentMes.LIST_SUCCESS) {}
export class GetDepartmentDetailResDTO extends createResponseDto(
  GetDepartmentDetailResSchema,
  DepartmentMes.DETAIL_SUCCESS
) {}
export class CreateDepartmentResDTO extends createResponseDto(
  CreateDepartmentResSchema,
  DepartmentMes.CREATE_SUCCESS
) {}
export class UpdateDepartmentResDTO extends createResponseDto(
  CreateDepartmentResSchema,
  DepartmentMes.UPDATE_SUCCESS
) {}
export class GetDepartmentHeadsResDTO extends createResponseDto(
  GetDepartmentHeadsResSchema,
  DepartmentMes.HEADS_SUCCESS
) {}
export class UpdateDepartmentEnhancedResDTO extends createZodDto(UpdateDepartmentEnhancedResSchema) {}
export class GetMyDepartmentResDTO extends createResponseDto(
  GetDepartmentDetailResSchema,
  DepartmentMes.MY_DEPARTMENT_SUCCESS
) {}

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested
} from 'class-validator'
import { Type } from 'class-transformer'
import { FieldType, RoleRequired } from '@prisma/client'

export class CreateGlobalFieldChildDto {
  @IsNotEmpty()
  @IsString()
  label: string

  @IsNotEmpty()
  @IsString()
  fieldName: string

  @IsOptional()
  @IsEnum(RoleRequired)
  roleRequired?: RoleRequired

  @IsOptional()
  options?: any

  @IsOptional()
  @IsNumber()
  displayOrder?: number

  @IsOptional()
  @IsString()
  tempId?: string // Temporary ID for this field

  @IsOptional()
  @IsString()
  parentTempId?: string // Temporary ID for parent reference

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGlobalFieldChildDto)
  children?: CreateGlobalFieldChildDto[] // Child fields (automatically TEXT type)
}

export class CreateGlobalFieldDto {
  @IsNotEmpty()
  @IsString()
  label: string

  @IsNotEmpty()
  @IsString()
  fieldName: string

  @IsNotEmpty()
  @IsEnum(FieldType)
  fieldType: FieldType

  @IsOptional()
  @IsEnum(RoleRequired)
  roleRequired?: RoleRequired

  @IsOptional()
  options?: any

  @IsOptional()
  @IsNumber()
  displayOrder?: number

  @IsOptional()
  @IsUUID()
  parentId?: string

  @IsOptional()
  @IsString()
  tempId?: string // Temporary ID for this field (used for PART/CHECK_BOX parent fields)

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGlobalFieldChildDto)
  children?: CreateGlobalFieldChildDto[] // Child fields for PART and CHECK_BOX types (automatically TEXT)
}

export class UpdateGlobalFieldChildDto {
  @IsOptional()
  @IsUUID()
  id?: string // Existing child field ID for updates

  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsString()
  fieldName?: string

  @IsOptional()
  @IsEnum(RoleRequired)
  roleRequired?: RoleRequired

  @IsOptional()
  options?: any

  @IsOptional()
  @IsString()
  tempId?: string // Temporary ID for new children

  @IsOptional()
  @IsString()
  parentTempId?: string // Temporary ID for parent reference

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateGlobalFieldChildDto)
  children?: UpdateGlobalFieldChildDto[] // Nested children updates

  @IsOptional()
  @IsBoolean()
  _delete?: boolean // Mark for deletion
}

export class UpdateGlobalFieldDto {
  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsString()
  fieldName?: string

  @IsOptional()
  @IsEnum(FieldType)
  fieldType?: FieldType

  @IsOptional()
  @IsEnum(RoleRequired)
  roleRequired?: RoleRequired

  @IsOptional()
  options?: any

  @IsOptional()
  @IsUUID()
  parentId?: string

  @IsOptional()
  @IsString()
  tempId?: string // For hierarchical updates

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateGlobalFieldChildDto)
  children?: UpdateGlobalFieldChildDto[] // Children updates for PART/CHECK_BOX fields
}

export class GetGlobalFieldByIdDto {
  @IsNotEmpty()
  @IsUUID()
  id: string
}

// Response DTOs
export class GlobalFieldBasicResponseDto {
  id: string
  label: string
  fieldName: string
  roleRequired?: RoleRequired
}

export class GlobalFieldPartialResponseDto {
  id: string
  label: string
  fieldName: string
  fieldType: FieldType
  roleRequired?: RoleRequired
  options?: any
}

export class GlobalFieldDetailResponseDto {
  id: string
  label: string
  fieldName: string
  fieldType: FieldType
  roleRequired?: RoleRequired
  options?: any
  parentId?: string
  createdAt: Date
  updatedAt: Date
  createdById?: string
  updatedById?: string

  // Relations
  parent?: GlobalFieldDetailResponseDto
  children?: GlobalFieldDetailResponseDto[]
  createdBy?: {
    id: string
    firstName: string
    lastName: string
  }
  updatedBy?: {
    id: string
    firstName: string
    lastName: string
  }
}

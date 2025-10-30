import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
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
import { EditByRole, RoleInSubject, FieldType, RoleRequired } from '@prisma/client'

// Response schema for parseTemplate (full schema with sections)
export const ParseTemplateResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  schema: z.record(z.string(), z.any()).optional(),
  placeholders: z.array(z.string()).optional()
})

export class ParseTemplateResponseDTO extends createZodDto(ParseTemplateResponseSchema) {}

export type ParseTemplateResponseType = z.infer<typeof ParseTemplateResponseSchema>

// Response schema for extractFields (just field names)
export const ExtractFieldsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  fields: z.array(
    z.object({
      fieldName: z.string(),
      fieldType: z.string(),
      displayOrder: z.number(),
      parentTempId: z.string().nullable(),
      tempId: z.string().optional()
    })
  ),
  totalFields: z.number()
})

export class ExtractFieldsResponseDTO extends createZodDto(ExtractFieldsResponseSchema) {}

export type ExtractFieldsResponseType = z.infer<typeof ExtractFieldsResponseSchema>

// Template Creation DTOs
export class CreateTemplateFieldDto {
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
  options?: any // JSONB

  @IsNotEmpty()
  @IsNumber()
  displayOrder: number

  @IsOptional()
  @IsString()
  parentTempId?: string // Temporary ID for parent reference
}

export class CreateTemplateSectionDto {
  @IsNotEmpty()
  @IsString()
  label: string

  @IsNotEmpty()
  @IsNumber()
  displayOrder: number

  @IsNotEmpty()
  @IsEnum(EditByRole)
  editBy: EditByRole

  @IsOptional()
  @IsEnum(RoleInSubject)
  roleInSubject?: RoleInSubject

  @IsOptional()
  @IsBoolean()
  isSubmittable?: boolean = false

  @IsOptional()
  @IsBoolean()
  isToggleDependent?: boolean = false

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateFieldDto)
  fields: CreateTemplateFieldDto[]
}

export class CreateTemplateFormDto {
  @IsNotEmpty()
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNotEmpty()
  @IsUUID()
  departmentId: string

  @IsNotEmpty()
  @IsString()
  templateContent: string

  @IsNotEmpty()
  @IsString()
  templateConfig: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateSectionDto)
  sections: CreateTemplateSectionDto[]
}

// Response DTOs
export class TemplateFieldResponseDto {
  id: string
  label: string
  fieldName: string
  fieldType: FieldType
  roleRequired?: RoleRequired
  options?: any
  displayOrder: number
  parentId?: string
  createdAt: Date
  updatedAt: Date
}

export class TemplateSectionResponseDto {
  id: string
  label: string
  displayOrder: number
  editBy: EditByRole
  roleInSubject?: RoleInSubject
  isSubmittable: boolean
  isToggleDependent: boolean
  fields: TemplateFieldResponseDto[]
}

export class TemplateFormResponseDto {
  id: string
  name: string
  description?: string
  version: number
  departmentId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  templateContent?: string
  templateConfig?: string
  templateSchema?: any
  sections: TemplateSectionResponseDto[]
}

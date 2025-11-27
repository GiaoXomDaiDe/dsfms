import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested
} from 'class-validator'
import { Type } from 'class-transformer'
import { EditByRole, RoleInSubject, FieldType, RoleRequired, TemplateStatus } from '@prisma/client'

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
  options?: any // JSONB - For VALUE_LIST fields: {"items": ["Pass", "Fail", "N/A"]}, for other fields: null or undefined

  @IsNotEmpty()
  @IsNumber()
  displayOrder: number

  @IsOptional()
  @IsString()
  parentTempId?: string // Temporary ID for parent reference

  @IsOptional()
  @IsString()
  tempId?: string // Temporary ID for this field (used for PART fields)
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

  @IsOptional()
  @IsEnum(['DRAFT', 'PENDING'], {
    message: 'Status must be either DRAFT or PENDING'
  })
  status?: Extract<TemplateStatus, 'DRAFT' | 'PENDING'>

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

export class UpdateTemplateFormDto {
  @IsNotEmpty()
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsUUID()
  departmentId?: string
}

export class CreateTemplateVersionDto {
  @IsNotEmpty()
  @IsUUID()
  originalTemplateId: string

  @IsNotEmpty()
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNotEmpty()
  @IsString()
  templateContent: string

  @IsNotEmpty()
  @IsString()
  templateConfig: string

  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'PENDING'])
  status?: 'DRAFT' | 'PENDING'

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
  createdByUserId: string
  updatedByUserId: string
  reviewedByUserId?: string
  reviewedAt?: Date
  templateContent?: string
  templateConfig?: string
  templateSchema?: any
  sections: TemplateSectionResponseDto[]
}

// ===== TEMPLATE REVIEW SCHEMAS =====

export const ReviewTemplateBodySchema = z
  .object({
    action: z.enum(['PUBLISHED', 'REJECTED'], {
      message: 'Action must be either PUBLISHED or REJECTED'
    }),
    comment: z.string().max(1000, 'Comment must not exceed 1000 characters').optional()
  })
  .refine(
    (data) => {
      if (data.action === 'REJECTED' && !data.comment) {
        return false
      }
      return true
    },
    {
      message: 'Comment is required for rejection',
      path: ['comment']
    }
  )

export const ReviewTemplateResSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    templateId: z.string().uuid(),
    templateName: z.string(),
    status: z.enum(['PUBLISHED', 'REJECTED']),
    previousStatus: z.string(),
    reviewedBy: z.string().uuid(),
    reviewedAt: z.coerce.date(),
    comment: z.string().nullable(),
    emailSent: z.boolean()
  })
})

export class ReviewTemplateBodyDTO extends createZodDto(ReviewTemplateBodySchema) {}
export class ReviewTemplateResDTO extends createZodDto(ReviewTemplateResSchema) {}

export type ReviewTemplateBodyType = z.infer<typeof ReviewTemplateBodySchema>
export type ReviewTemplateResType = z.infer<typeof ReviewTemplateResSchema>

import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { FieldType, RoleRequired } from '@prisma/client';

export class CreateGlobalFieldDto {
  @IsNotEmpty()
  @IsString()
  label: string;

  @IsNotEmpty()
  @IsString()
  fieldName: string;

  @IsNotEmpty()
  @IsEnum(FieldType)
  fieldType: FieldType;

  @IsOptional()
  @IsEnum(RoleRequired)
  roleRequired?: RoleRequired;

  @IsOptional()
  options?: any;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateGlobalFieldDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  fieldName?: string;

  @IsOptional()
  @IsEnum(FieldType)
  fieldType?: FieldType;

  @IsOptional()
  @IsEnum(RoleRequired)
  roleRequired?: RoleRequired;

  @IsOptional()
  options?: any;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class GetGlobalFieldByIdDto {
  @IsNotEmpty()
  @IsUUID()
  id: string;
}

// Response DTOs
export class GlobalFieldBasicResponseDto {
  id: string;
  label: string;
  fieldName: string;
  roleRequired?: RoleRequired;
}

export class GlobalFieldPartialResponseDto {
  id: string;
  label: string;
  fieldName: string;
  fieldType: FieldType;
  roleRequired?: RoleRequired;
  options?: any;
}

export class GlobalFieldDetailResponseDto {
  id: string;
  label: string;
  fieldName: string;
  fieldType: FieldType;
  roleRequired?: RoleRequired;
  options?: any;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdById?: string;
  updatedById?: string;

  // Relations
  parent?: GlobalFieldDetailResponseDto;
  children?: GlobalFieldDetailResponseDto[];
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  updatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}
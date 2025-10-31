import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  CreatePermissionBodyDTO,
  GetPermissionDetailResDTO,
  GetPermissionParamsDTO,
  GetPermissionsQueryDTO,
  GetPermissionsResDTO,
  UpdatePermissionBodyDTO
} from '~/routes/permission/permission.dto'
import { PermissionMes } from '~/routes/permission/permission.message'
import { PermissionService } from '~/routes/permission/permission.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import {
  ExcludePermissionModules,
  ExcludedPermissionModules
} from '~/shared/decorators/exclude-permission-modules.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @ExcludePermissionModules('Authentication Management', 'System Services')
  @ZodSerializerDto(GetPermissionsResDTO)
  async list(
    @Query() { includeDeleted }: GetPermissionsQueryDTO,
    @ActiveRolePermissions('name') roleName: string,
    @ExcludedPermissionModules() excludedModules: string[]
  ) {
    const result = await this.permissionService.list({
      includeDeleted,
      userRole: roleName,
      excludeModules: excludedModules
    })

    return {
      message: PermissionMes.LIST_SUCCESS,
      data: result
    }
  }

  @Get(':permissionId')
  @ZodSerializerDto(GetPermissionDetailResDTO)
  async findById(
    @Param() params: GetPermissionParamsDTO,
    @Query() query: GetPermissionsQueryDTO,
    @ActiveRolePermissions('name') roleName: string
  ) {
    const permission = await this.permissionService.findById(params.permissionId, {
      includeDeleted: query.includeDeleted,
      userRole: roleName
    })
    return {
      message: PermissionMes.DETAIL_SUCCESS,
      data: permission
    }
  }

  @Post()
  @ZodSerializerDto(GetPermissionDetailResDTO)
  async create(@Body() body: CreatePermissionBodyDTO, @ActiveUser('userId') userId: string) {
    const permission = await this.permissionService.create({
      data: body,
      createdById: userId
    })
    return {
      message: PermissionMes.CREATE_SUCCESS,
      data: permission
    }
  }

  @Put(':permissionId')
  @ZodSerializerDto(GetPermissionDetailResDTO)
  async update(
    @Body() body: UpdatePermissionBodyDTO,
    @Param() params: GetPermissionParamsDTO,
    @ActiveUser('userId') userId: string
  ) {
    const permission = await this.permissionService.update({
      data: body,
      id: params.permissionId,
      updatedById: userId
    })
    return {
      message: PermissionMes.UPDATE_SUCCESS,
      data: permission
    }
  }

  @Delete(':permissionId')
  @ZodSerializerDto(MessageResDTO)
  delete(@Param() params: GetPermissionParamsDTO, @ActiveUser('userId') userId: string) {
    return this.permissionService.delete({
      id: params.permissionId,
      deletedById: userId
    })
  }

  @Patch(':permissionId/enable')
  @ZodSerializerDto(MessageResDTO)
  enable(@Param() params: GetPermissionParamsDTO, @ActiveUser('userId') userId: string) {
    return this.permissionService.enable({
      id: params.permissionId,
      enabledById: userId
    })
  }
}

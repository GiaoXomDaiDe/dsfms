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
import { PermissionService } from '~/routes/permission/permission.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}
  @Get()
  @ZodSerializerDto(GetPermissionsResDTO)
  list(@Query() { includeDeleted }: GetPermissionsQueryDTO, @ActiveRolePermissions('name') roleName: string) {
    return this.permissionService.list({
      includeDeleted,
      userRole: roleName
    })
  }

  @Get(':permissionId')
  @ZodSerializerDto(GetPermissionDetailResDTO)
  findById(
    @Param() params: GetPermissionParamsDTO,
    @Query() query: GetPermissionsQueryDTO,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return this.permissionService.findById(params.permissionId, {
      includeDeleted: query.includeDeleted,
      userRole: roleName
    })
  }

  @Post()
  create(@Body() Body: CreatePermissionBodyDTO, @ActiveUser('userId') userId: string) {
    return this.permissionService.create({
      data: Body,
      createdById: userId
    })
  }

  @Put(':permissionId')
  @ZodSerializerDto(GetPermissionDetailResDTO)
  update(
    @Body() body: UpdatePermissionBodyDTO,
    @Param() params: GetPermissionParamsDTO,
    @ActiveUser('userId') userId: string
  ) {
    return this.permissionService.update({
      data: body,
      id: params.permissionId,
      updatedById: userId
    })
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
  @ZodSerializerDto(GetPermissionDetailResDTO)
  enable(
    @Param() params: GetPermissionParamsDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return this.permissionService.enable({
      id: params.permissionId,
      enabledById: userId,
      enablerRole: roleName
    })
  }
}

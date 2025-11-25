import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'
import {
  AssignPermissionGroupPermissionsBodyDto,
  AssignPermissionGroupPermissionsResDto,
  CreatePermissionGroupBodyDto,
  PermissionGroupDetailResDto,
  PermissionGroupListResDto,
  PermissionGroupParamsDto,
  PermissionGroupResDto,
  UpdatePermissionGroupBodyDto
} from './permission-group.dto'
import { PermissionGroupMes } from './permission-group.message'
import { PermissionGroupService } from './permission-group.service'

@Controller('permission-groups')
export class PermissionGroupController {
  constructor(private readonly permissionGroupService: PermissionGroupService) {}

  @Post()
  @IsPublic()
  @ZodSerializerDto(PermissionGroupResDto)
  async create(@Body() body: CreatePermissionGroupBodyDto) {
    const data = await this.permissionGroupService.create(body)
    return { message: PermissionGroupMes.CREATE_SUCCESS, data }
  }

  @Get()
  @ZodSerializerDto(PermissionGroupListResDto)
  async findAll() {
    const data = await this.permissionGroupService.list()
    return { message: PermissionGroupMes.LIST_SUCCESS, data }
  }

  @Get(':permissionGroupId')
  @IsPublic()
  @ZodSerializerDto(PermissionGroupDetailResDto)
  async findOne(@Param() { permissionGroupId }: PermissionGroupParamsDto) {
    const data = await this.permissionGroupService.findOne(permissionGroupId)
    return { message: PermissionGroupMes.DETAIL_SUCCESS, data }
  }

  @Patch(':permissionGroupId')
  @IsPublic()
  @ZodSerializerDto(MessageResDTO)
  async update(@Param() { permissionGroupId }: PermissionGroupParamsDto, @Body() body: UpdatePermissionGroupBodyDto) {
    await this.permissionGroupService.update(permissionGroupId, body)
    return { message: PermissionGroupMes.UPDATE_SUCCESS }
  }

  @Delete(':permissionGroupId')
  @IsPublic()
  @ZodSerializerDto(MessageResDTO)
  async remove(@Param() { permissionGroupId }: PermissionGroupParamsDto) {
    await this.permissionGroupService.remove(permissionGroupId)
    return { message: PermissionGroupMes.DELETE_SUCCESS }
  }

  @Post(':permissionGroupId/permissions')
  @IsPublic()
  @ZodSerializerDto(AssignPermissionGroupPermissionsResDto)
  async assignPermissions(
    @Param() { permissionGroupId }: PermissionGroupParamsDto,
    @Body() body: AssignPermissionGroupPermissionsBodyDto
  ) {
    const data = await this.permissionGroupService.assignPermissions(permissionGroupId, body)
    return { message: PermissionGroupMes.ASSIGN_SUCCESS, data }
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  CreateRoleBodyDTO,
  CreateRoleResDTO,
  GetRoleDetailResDTO,
  GetRoleParamsDTO,
  GetRolesQueryDTO,
  GetRolesResDTO,
  UpdateRoleBodyDTO
} from '~/routes/role/role.dto'
import { RoleService } from '~/routes/role/role.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ZodSerializerDto(GetRolesResDTO)
  list(@Query() query: GetRolesQueryDTO, @ActiveRolePermissions('name') roleName: string) {
    return this.roleService.list({
      includeDeleted: query.includeDeleted,
      userRole: roleName
    })
  }

  @Get(':roleId')
  @ZodSerializerDto(GetRoleDetailResDTO)
  findById(
    @Param() params: GetRoleParamsDTO,
    @Query() query: GetRolesQueryDTO,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return this.roleService.findById(params.roleId, {
      includeDeleted: query.includeDeleted,
      userRole: roleName
    })
  }

  @Post()
  @ZodSerializerDto(CreateRoleResDTO)
  create(@Body() body: CreateRoleBodyDTO, @ActiveUser('userId') userId: string) {
    return this.roleService.create({
      data: body,
      createdById: userId
    })
  }

  @Put(':roleId')
  @ZodSerializerDto(GetRoleDetailResDTO)
  update(@Body() body: UpdateRoleBodyDTO, @Param() params: GetRoleParamsDTO, @ActiveUser('userId') userId: string) {
    return this.roleService.update({
      data: body,
      id: params.roleId,
      updatedById: userId
    })
  }

  @Delete(':roleId')
  @ZodSerializerDto(MessageResDTO)
  delete(@Param() params: GetRoleParamsDTO, @ActiveUser('userId') userId: string) {
    return this.roleService.delete({
      id: params.roleId,
      deletedById: userId
    })
  }

  @Patch(':roleId/enable')
  @ZodSerializerDto(GetRoleDetailResDTO)
  enable(
    @Param() params: GetRoleParamsDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return this.roleService.enable({
      id: params.roleId,
      enabledById: userId,
      enablerRole: roleName
    })
  }
}

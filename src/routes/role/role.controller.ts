import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  AddPermissionsToRoleBodyDTO,
  AddPermissionsToRoleResDTO,
  CreateRoleBodyDTO,
  CreateRoleResDTO,
  GetRoleDetailResDTO,
  GetRoleParamsDTO,
  GetRolesQueryDTO,
  GetRolesResDTO,
  UpdateRoleBodyDTO,
  UpdateRoleResDTO
} from '~/routes/role/role.dto'
import { RoleService } from '~/routes/role/role.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ZodSerializerDto(GetRolesResDTO)
  list(@Query() { includeDeleted }: GetRolesQueryDTO, @ActiveRolePermissions('name') roleName: string) {
    return this.roleService.list({
      includeDeleted,
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
  @ZodSerializerDto(UpdateRoleResDTO)
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
  @ZodSerializerDto(MessageResDTO)
  enable(@Param() params: GetRoleParamsDTO, @ActiveUser('userId') userId: string) {
    return this.roleService.enable({
      id: params.roleId,
      enabledById: userId
    })
  }

  /**
   * Internal API: Add permissions to a role
   */
  @Patch(':roleId/add-permissions')
  @IsPublic()
  @ZodSerializerDto(AddPermissionsToRoleResDTO)
  addPermissions(
    @Param() params: GetRoleParamsDTO,
    @Body() body: AddPermissionsToRoleBodyDTO,
    @ActiveUser('userId') userId: string
  ) {
    return this.roleService.addPermissions({
      roleId: params.roleId,
      permissionIds: body.permissionIds,
      updatedById: userId
    })
  }
}

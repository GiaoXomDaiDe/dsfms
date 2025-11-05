import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  AddPermissionsToRoleBodyDTO,
  AddPermissionsToRoleResDTO,
  CreateRoleBodyDTO,
  CreateRoleResDTO,
  GetRoleDetailResDTO,
  GetRoleParamsDTO,
  GetRolesResDTO,
  RemovePermissionsFromRoleBodyDTO,
  RemovePermissionsFromRoleResDTO,
  UpdateRoleBodyDTO,
  UpdateRoleResDTO
} from '~/routes/role/role.dto'
import { RoleMes } from '~/routes/role/role.message'
import { RoleService } from '~/routes/role/role.service'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ZodSerializerDto(GetRolesResDTO)
  async list() {
    const result = await this.roleService.list()
    return {
      message: RoleMes.LIST_SUCCESS,
      data: result
    }
  }

  @Get(':roleId')
  @ZodSerializerDto(GetRoleDetailResDTO)
  async findById(@Param() { roleId }: GetRoleParamsDTO) {
    const role = await this.roleService.findById(roleId)
    return {
      message: RoleMes.DETAIL_SUCCESS,
      data: role
    }
  }

  @Post()
  @ZodSerializerDto(CreateRoleResDTO)
  async create(@Body() body: CreateRoleBodyDTO, @ActiveUser('userId') userId: string) {
    const role = await this.roleService.create({
      data: body,
      createdById: userId
    })
    return {
      message: RoleMes.CREATE_SUCCESS,
      data: role
    }
  }

  @Put(':roleId')
  @ZodSerializerDto(UpdateRoleResDTO)
  async update(
    @Body() body: UpdateRoleBodyDTO,
    @Param() { roleId }: GetRoleParamsDTO,
    @ActiveUser('userId') userId: string
  ) {
    const role = await this.roleService.update({
      data: body,
      id: roleId,
      updatedById: userId
    })
    return {
      message: RoleMes.UPDATE_SUCCESS,
      data: role
    }
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
  async addPermissions(
    @Param() { roleId }: GetRoleParamsDTO,
    @Body() body: AddPermissionsToRoleBodyDTO,
    @ActiveUser('userId') userId: string
  ) {
    const result = await this.roleService.addPermissions({
      roleId,
      permissionIds: body.permissionIds,
      updatedById: userId
    })
    return {
      message: RoleMes.ADD_PERMISSIONS_SUCCESS,
      data: result
    }
  }

  @Patch(':roleId/remove-permissions')
  @IsPublic()
  @ZodSerializerDto(RemovePermissionsFromRoleResDTO)
  async removePermissions(
    @Param() { roleId }: GetRoleParamsDTO,
    @Body() body: RemovePermissionsFromRoleBodyDTO,
    @ActiveUser('userId') userId: string
  ) {
    const result = await this.roleService.removePermissions({
      roleId,
      permissionIds: body.permissionIds,
      updatedById: userId
    })
    return {
      message: RoleMes.REMOVE_PERMISSIONS_SUCCESS,
      data: result
    }
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  CreatePermissionBodyDTO,
  GetPermissionDetailResDTO,
  GetPermissionParamsDTO,
  GetPermissionsQueryDTO,
  GetPermissionsResDTO
} from '~/routes/permission/permission.dto'
import { PermissionService } from '~/routes/permission/permission.service'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}
  @Get()
  @ZodSerializerDto(GetPermissionsResDTO)
  list(@Query() query: GetPermissionsQueryDTO) {
    return this.permissionService.list({
      page: query.page,
      limit: query.limit
    })
  }

  @Get(':permissionId')
  @ZodSerializerDto(GetPermissionDetailResDTO)
  findById(@Param() params: GetPermissionParamsDTO) {
    return this.permissionService.findById(params.permissionId)
  }

  @Post()
  create(@Body() Body: CreatePermissionBodyDTO, @ActiveUser('userId') userId: string) {
    return this.permissionService.create({
      data: Body,
      createdById: userId
    })
  }
}

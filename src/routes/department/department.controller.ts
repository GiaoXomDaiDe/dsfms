import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  AddTrainersToDepartmentBodyDTO,
  CreateDepartmentBodyDTO,
  CreateDepartmentResDTO,
  GetDepartmentDetailResDTO,
  GetDepartmentHeadsResDTO,
  GetDepartmentParamsDTO,
  GetDepartmentsQueryDTO,
  GetDepartmentsResDTO,
  UpdateDepartmentBodyDTO
} from '~/routes/department/department.dto'
import { DepartmentService } from '~/routes/department/department.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @ZodSerializerDto(GetDepartmentsResDTO)
  list(@Query() query: GetDepartmentsQueryDTO, @ActiveRolePermissions('name') roleName: string) {
    return this.departmentService.list({
      includeDeleted: query.includeDeleted,
      userRole: roleName
    })
  }

  @Get(':departmentId')
  @ZodSerializerDto(GetDepartmentDetailResDTO)
  findById(
    @Param() params: GetDepartmentParamsDTO,
    @Query() query: GetDepartmentsQueryDTO,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return this.departmentService.findById(params.departmentId, {
      includeDeleted: query.includeDeleted,
      userRole: roleName
    })
  }

  @Post()
  @ZodSerializerDto(CreateDepartmentResDTO)
  create(@Body() body: CreateDepartmentBodyDTO, @ActiveUser('userId') userId: string) {
    return this.departmentService.create({
      data: body,
      createdById: userId
    })
  }

  @Put(':departmentId')
  @ZodSerializerDto(GetDepartmentDetailResDTO)
  update(
    @Body() body: UpdateDepartmentBodyDTO,
    @Param() params: GetDepartmentParamsDTO,
    @ActiveUser('userId') userId: string
  ) {
    return this.departmentService.update({
      data: body,
      id: params.departmentId,
      updatedById: userId
    })
  }

  @Delete(':departmentId')
  @ZodSerializerDto(MessageResDTO)
  delete(@Param() params: GetDepartmentParamsDTO, @ActiveUser('userId') userId: string) {
    return this.departmentService.delete({
      id: params.departmentId,
      deletedById: userId
    })
  }

  @Patch(':departmentId/enable')
  @ZodSerializerDto(GetDepartmentDetailResDTO)
  enable(
    @Param() params: GetDepartmentParamsDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return this.departmentService.enable({
      id: params.departmentId,
      enabledById: userId,
      enablerRole: roleName
    })
  }

  @Get('helpers/department-heads')
  @ZodSerializerDto(GetDepartmentHeadsResDTO)
  getDepartmentHeads() {
    return this.departmentService.getDepartmentHeads()
  }

  @Patch(':departmentId/add-trainers')
  @ZodSerializerDto(MessageResDTO)
  addTrainersToDepartment(
    @Param() params: GetDepartmentParamsDTO,
    @Body() body: AddTrainersToDepartmentBodyDTO,
    @ActiveUser('userId') userId: string
  ) {
    return this.departmentService.addTrainersToDepartment({
      departmentId: params.departmentId,
      trainerEids: body.trainerEids,
      updatedById: userId
    })
  }
}

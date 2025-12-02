import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  CreateDepartmentBodyDTO,
  CreateDepartmentResDTO,
  GetDepartmentDetailResDTO,
  GetDepartmentHeadsResDTO,
  GetDepartmentParamsDTO,
  GetDepartmentsResDTO,
  GetMyDepartmentResDTO,
  UpdateDepartmentBodyDTO,
  UpdateDepartmentResDTO
} from '~/routes/department/department.dto'
import { DepartmentMes } from '~/routes/department/department.message'
import { DepartmentService } from '~/routes/department/department.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @ZodSerializerDto(GetDepartmentsResDTO)
  async list() {
    const departments = await this.departmentService.list()
    return {
      message: DepartmentMes.LIST_SUCCESS,
      data: departments
    }
  }

  @Get('me')
  @ZodSerializerDto(GetMyDepartmentResDTO)
  async getMyDepartment(@ActiveUser('userId') userId: string) {
    const department = await this.departmentService.getMyDepartment(userId)
    return {
      message: DepartmentMes.MY_DEPARTMENT_SUCCESS,
      data: department
    }
  }

  @Get(':departmentId')
  @ZodSerializerDto(GetDepartmentDetailResDTO)
  async findById(@Param() params: GetDepartmentParamsDTO) {
    const department = await this.departmentService.findById(params.departmentId)
    return {
      message: DepartmentMes.DETAIL_SUCCESS,
      data: department
    }
  }

  @Post()
  @ZodSerializerDto(CreateDepartmentResDTO)
  async create(@Body() body: CreateDepartmentBodyDTO, @ActiveUser('userId') userId: string) {
    const department = await this.departmentService.create({
      data: body,
      createdById: userId
    })
    return {
      message: DepartmentMes.CREATE_SUCCESS,
      data: department
    }
  }

  @Put(':departmentId')
  @ZodSerializerDto(UpdateDepartmentResDTO)
  async update(
    @Body() body: UpdateDepartmentBodyDTO,
    @Param() params: GetDepartmentParamsDTO,
    @ActiveUser('userId') userId: string
  ) {
    const department = await this.departmentService.update({
      data: body,
      id: params.departmentId,
      updatedById: userId
    })
    return {
      message: DepartmentMes.UPDATE_SUCCESS,
      data: department
    }
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
  @ZodSerializerDto(MessageResDTO)
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
  async getDepartmentHeads() {
    const heads = await this.departmentService.getDepartmentHeads()
    return {
      message: DepartmentMes.HEADS_SUCCESS,
      data: heads
    }
  }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  BulkCreateResultDTO,
  CreateBulkUsersBodyDTO,
  CreateUserBodyWithProfileDTO,
  CreateUserResDTO,
  GetUserParamsDTO,
  GetUserProfileResDTO,
  GetUsersQueryDTO,
  GetUsersResDTO,
  UpdateUserBodyWithProfileDTO,
  UpdateUserResDTO
} from '~/routes/user/user.dto'
import { UserMes } from '~/routes/user/user.message'
import { UserService } from '~/routes/user/user.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ZodSerializerDto(GetUsersResDTO)
  async list(@Query() query: GetUsersQueryDTO) {
    const result = await this.userService.list(query)
    return {
      message: UserMes.LIST_SUCCESS,
      data: result
    }
  }

  @Get(':userId')
  @ZodSerializerDto(GetUserProfileResDTO)
  async findById(@Param() params: GetUserParamsDTO) {
    const data = await this.userService.findById(params.userId)
    return {
      message: UserMes.DETAIL_SUCCESS,
      data
    }
  }

  @Post()
  @ZodSerializerDto(CreateUserResDTO)
  async create(@Body() body: CreateUserBodyWithProfileDTO, @ActiveUser('userId') userId: string) {
    const data = await this.userService.create({
      data: body,
      createdById: userId
    })
    return {
      message: UserMes.CREATE_SUCCESS,
      data
    }
  }

  @Post('bulk')
  @ZodSerializerDto(BulkCreateResultDTO)
  async createBulk(@Body() body: CreateBulkUsersBodyDTO, @ActiveUser('userId') userId: string) {
    const data = await this.userService.createBulk({
      data: body,
      createdById: userId
    })
    return {
      message: UserMes.BULK_CREATE_SUCCESS,
      data
    }
  }

  @Put(':userId')
  @ZodSerializerDto(UpdateUserResDTO)
  async update(
    @Body() body: UpdateUserBodyWithProfileDTO,
    @Param() params: GetUserParamsDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    const data = await this.userService.update({
      data: body,
      id: params.userId,
      updatedById: userId,
      updatedByRoleName: roleName
    })
    return {
      message: UserMes.UPDATE_SUCCESS,
      data
    }
  }

  @Delete(':userId')
  @ZodSerializerDto(MessageResDTO)
  delete(@Param() params: GetUserParamsDTO, @ActiveUser('userId') userId: string) {
    return this.userService.delete({
      id: params.userId,
      deletedById: userId
    })
  }

  @Patch(':userId/enable')
  @ZodSerializerDto(MessageResDTO)
  enable(@Param() param: GetUserParamsDTO, @ActiveUser('userId') userId: string) {
    return this.userService.enable({
      id: param.userId,
      enabledById: userId
    })
  }
}

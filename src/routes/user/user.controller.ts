import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  BulkCreateResultDTO,
  BulkTraineeLookupBodyDTO,
  BulkTraineeLookupResDTO,
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
import { UserService } from '~/routes/user/user.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ZodSerializerDto(GetUsersResDTO)
  list(
    @Query() { includeDeleted, roleName }: GetUsersQueryDTO,
    @ActiveRolePermissions('name') activeUserRoleName: string
  ) {
    return this.userService.list({
      includeDeleted,
      roleName,
      activeUserRoleName
    })
  }

  @Get(':userId')
  @ZodSerializerDto(GetUserProfileResDTO)
  findById(
    @Param() { userId }: GetUserParamsDTO,
    @Query() { includeDeleted }: GetUsersQueryDTO,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return this.userService.findById(userId, {
      includeDeleted,
      userRole: roleName
    })
  }

  @Post()
  @ZodSerializerDto(CreateUserResDTO)
  create(@Body() body: CreateUserBodyWithProfileDTO, @ActiveUser('userId') userId: string) {
    return this.userService.create({
      data: body,
      createdById: userId
    })
  }

  @Post('bulk')
  @ZodSerializerDto(BulkCreateResultDTO)
  createBulk(@Body() body: CreateBulkUsersBodyDTO, @ActiveUser('userId') userId: string) {
    return this.userService.createBulk({
      data: body,
      createdById: userId
    })
  }

  @Post('lookup/trainees')
  @ZodSerializerDto(BulkTraineeLookupResDTO)
  bulkTraineeLookup(@Body() body: BulkTraineeLookupBodyDTO) {
    return this.userService.bulkTraineeLookup(body)
  }

  @Put(':userId')
  @ZodSerializerDto(UpdateUserResDTO)
  update(
    @Body() body: UpdateUserBodyWithProfileDTO,
    @Param() params: GetUserParamsDTO,
    @Query() { includeDeleted }: GetUsersQueryDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return this.userService.update({
      data: body,
      id: params.userId,
      updatedById: userId,
      updatedByRoleName: roleName,
      includeDeleted
    })
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

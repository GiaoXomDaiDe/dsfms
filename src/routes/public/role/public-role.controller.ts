import { Controller, Get, Param } from '@nestjs/common'
import { createZodDto, ZodSerializerDto } from 'nestjs-zod'
import { z } from 'zod'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { GetPublicRolesResDTO, PublicRoleDTO } from './public-role.dto'
import { PublicRoleService } from './public-role.service'

// Param validation
const PublicRoleParamsSchema = z.object({
  roleId: z.string().uuid()
})

class PublicRoleParamsDTO extends createZodDto(PublicRoleParamsSchema) {}

@Controller('public/roles')
export class PublicRoleController {
  constructor(private readonly publicRoleService: PublicRoleService) {}

  /**
   * GET /public/roles
   * Lấy tất cả roles active - dùng cho dropdowns khi tạo user
   */
  @Get()
  @IsPublic()
  @ZodSerializerDto(GetPublicRolesResDTO)
  async getAllRoles() {
    return await this.publicRoleService.getAllActive()
  }

  /**
   * GET /public/roles/:roleId
   * Lấy thông tin role theo ID - không cần permission
   */
  @Get(':roleId')
  @IsPublic()
  @ZodSerializerDto(PublicRoleDTO)
  async getRoleById(@Param() params: PublicRoleParamsDTO) {
    const role = await this.publicRoleService.getById(params.roleId)

    if (!role) {
      throw new Error('Role not found')
    }

    return role
  }
}

import { Controller, Get, Param } from '@nestjs/common'
import { createZodDto, ZodSerializerDto } from 'nestjs-zod'
import { z } from 'zod'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { GetPublicDepartmentsResDTO, PublicDepartmentDTO } from './public-department.dto'
import { PublicDepartmentService } from './public-department.service'

// Param validation for department ID
const PublicDepartmentParamsSchema = z.object({
  departmentId: z.string().uuid()
})

class PublicDepartmentParamsDTO extends createZodDto(PublicDepartmentParamsSchema) {}

@Controller('public/departments')
export class PublicDepartmentController {
  constructor(private readonly publicDepartmentService: PublicDepartmentService) {}

  /**
   * GET /public/departments
   * Lấy tất cả departments active - không cần permission
   * Chỉ trả về thông tin cơ bản, an toàn
   */
  @Get()
  @IsPublic()
  @ZodSerializerDto(GetPublicDepartmentsResDTO)
  async getAllDepartments() {
    return await this.publicDepartmentService.getAllActive()
  }

  /**
   * GET /public/departments/:departmentId
   * Lấy thông tin department theo ID - không cần permission
   * Chỉ trả về thông tin cơ bản, an toàn
   */
  @Get(':departmentId')
  @IsPublic()
  @ZodSerializerDto(PublicDepartmentDTO)
  async getDepartmentById(@Param() params: PublicDepartmentParamsDTO) {
    const department = await this.publicDepartmentService.getById(params.departmentId)

    if (!department) {
      throw new Error('Department not found')
    }

    return department
  }
}

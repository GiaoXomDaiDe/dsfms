import { Controller, Get, Param } from '@nestjs/common'
import { createZodDto, ZodSerializerDto } from 'nestjs-zod'
import { z } from 'zod'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { GetPublicCoursesResDTO, PublicCourseDTO } from './public-course.dto'
import { PublicCourseService } from './public-course.service'

// Param validation
const PublicCourseParamsSchema = z.object({
  courseId: z.string().uuid()
})

const PublicCourseDepartmentParamsSchema = z.object({
  departmentId: z.string().uuid()
})

class PublicCourseParamsDTO extends createZodDto(PublicCourseParamsSchema) {}
class PublicCourseDepartmentParamsDTO extends createZodDto(PublicCourseDepartmentParamsSchema) {}

@Controller('public/courses')
export class PublicCourseController {
  constructor(private readonly publicCourseService: PublicCourseService) {}

  /**
   * GET /public/courses
   * Lấy tất cả courses active - dùng cho dropdowns
   */
  @Get()
  @IsPublic()
  @ZodSerializerDto(GetPublicCoursesResDTO)
  async getAllCourses() {
    return await this.publicCourseService.getAllActive()
  }

  /**
   * GET /public/courses/department/:departmentId
   * Lấy courses theo department - dùng khi tạo user thuộc department cụ thể
   */
  @Get('department/:departmentId')
  @IsPublic()
  @ZodSerializerDto(GetPublicCoursesResDTO)
  async getCoursesByDepartment(@Param() params: PublicCourseDepartmentParamsDTO) {
    return await this.publicCourseService.getByDepartmentId(params.departmentId)
  }

  /**
   * GET /public/courses/:courseId
   * Lấy thông tin course theo ID - không cần permission
   */
  @Get(':courseId')
  @IsPublic()
  @ZodSerializerDto(PublicCourseDTO)
  async getCourseById(@Param() params: PublicCourseParamsDTO) {
    const course = await this.publicCourseService.getById(params.courseId)

    if (!course) {
      throw new Error('Course not found')
    }

    return course
  }
}

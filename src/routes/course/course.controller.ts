import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request } from '@nestjs/common'
import { CourseService } from './course.service'
import { CreateCourseBodyDto, UpdateCourseBodyDto, GetCoursesQueryDto } from './course.model'

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  async getCourses(@Query() query: GetCoursesQueryDto) {
    return await this.courseService.list(query)
  }

  @Get('stats')
  async getCourseStats(@Query('includeDeleted') includeDeleted?: string) {
    return await this.courseService.getStats({
      includeDeleted: includeDeleted === 'true'
    })
  }

  @Get('department/:departmentId')
  async getCoursesByDepartment(
    @Param('departmentId') departmentId: string,
    @Query('includeDeleted') includeDeleted?: string
  ) {
    return await this.courseService.getCoursesByDepartment({
      departmentId,
      includeDeleted: includeDeleted === 'true'
    })
  }

  @Get(':id')
  async getCourseById(@Param('id') id: string, @Query('includeDeleted') includeDeleted?: string) {
    return await this.courseService.findById(id, {
      includeDeleted: includeDeleted === 'true'
    })
  }

  @Post()
  async createCourse(@Body() createCourseDto: CreateCourseBodyDto, @Request() req: any) {
    const { user } = req
    return await this.courseService.create({
      data: createCourseDto,
      createdById: user.id,
      createdByRoleName: user.roleName
    })
  }

  @Put(':id')
  async updateCourse(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseBodyDto, @Request() req: any) {
    const { user } = req
    return await this.courseService.update({
      id,
      data: updateCourseDto,
      updatedById: user.id,
      updatedByRoleName: user.roleName
    })
  }

  @Delete(':id')
  async deleteCourse(@Param('id') id: string, @Request() req: any, @Query('hard') hard?: string) {
    const { user } = req
    return await this.courseService.delete({
      id,
      deletedById: user.id,
      deletedByRoleName: user.roleName,
      isHard: hard === 'true'
    })
  }

  @Post(':id/restore')
  async restoreCourse(@Param('id') id: string, @Request() req: any) {
    const { user } = req
    return await this.courseService.restore({
      id,
      restoredById: user.id,
      restoredByRoleName: user.roleName
    })
  }

  @Get(':id/access-check')
  async checkCourseAccess(@Param('id') id: string, @Request() req: any) {
    const { user } = req
    const hasAccess = await this.courseService.validateCourseAccess({
      courseId: id,
      userId: user.id,
      userRole: user.roleName
    })

    return { hasAccess }
  }
}

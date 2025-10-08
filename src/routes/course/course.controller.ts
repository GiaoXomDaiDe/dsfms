import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request } from '@nestjs/common'
import {
  AddSubjectToCourseBodyDto,
  CreateCourseBodyDto,
  GetCoursesQueryDto,
  RemoveSubjectFromCourseBodyDto,
  UpdateCourseBodyDto
} from './course.model'
import { CourseService } from './course.service'

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  async getCourses(@Query() query: GetCoursesQueryDto, @Request() req: any) {
    const { user } = req
    return await this.courseService.list(query, {
      userId: user.id,
      userRole: user.roleName,
      departmentId: user.departmentId
    })
  }

  @Get('department/:departmentId')
  async getCoursesByDepartment(
    @Param('departmentId') departmentId: string,
    @Query() query: GetCoursesQueryDto,
    @Request() req: any
  ) {
    const { user } = req
    return await this.courseService.getDepartmentWithCourses({
      departmentId,
      includeDeleted: query.includeDeleted,
      query,
      userId: user.id,
      userRole: user.roleName
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
      createdByRoleName: user.roleName,
      userDepartmentId: user.departmentId
    })
  }

  @Put(':id')
  async updateCourse(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseBodyDto, @Request() req: any) {
    const { user } = req
    return await this.courseService.update({
      id,
      data: updateCourseDto,
      updatedById: user.id,
      updatedByRoleName: user.roleName,
      userDepartmentId: user.departmentId
    })
  }

  @Delete(':id')
  async deleteCourse(@Param('id') id: string, @Request() req: any, @Query('hard') hard?: string) {
    const { user } = req
    return await this.courseService.delete({
      id,
      deletedById: user.id,
      deletedByRoleName: user.roleName,
      userDepartmentId: user.departmentId,
      isHard: hard === 'true'
    })
  }

  @Post(':id/archive')
  async archiveCourse(@Param('id') id: string, @Request() req: any) {
    const { user } = req
    return await this.courseService.archive({
      id,
      archivedById: user.id,
      archivedByRoleName: user.roleName,
      userDepartmentId: user.departmentId
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

  @Post(':id/subjects')
  async addSubjectsToCourse(@Param('id') id: string, @Body() body: AddSubjectToCourseBodyDto, @Request() req: any) {
    const { user } = req
    return await this.courseService.addSubjectsToCourse({
      courseId: id,
      data: body,
      userRole: user.roleName
    })
  }

  @Delete(':id/subjects')
  async removeSubjectsFromCourse(
    @Param('id') id: string,
    @Body() body: RemoveSubjectFromCourseBodyDto,
    @Request() req: any
  ) {
    const { user } = req
    return await this.courseService.removeSubjectsFromCourse({
      courseId: id,
      data: body,
      userRole: user.roleName
    })
  }
}

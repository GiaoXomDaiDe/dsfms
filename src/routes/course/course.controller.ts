import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  CancelCourseEnrollmentsBodyDto,
  CreateCourseBodyDto,
  CreateCourseResDto,
  GetCourseParamsDto,
  GetCourseResDto,
  GetCoursesQueryDto,
  GetCoursesResDto,
  GetCourseTraineesQueryDto,
  GetCourseTraineesResDto,
  GetTraineeEnrollmentsResDto,
  UpdateCourseBodyDto,
  UpdateCourseResDto
} from '~/routes/course/course.dto'
import { CourseService } from '~/routes/course/course.service'
import { CancelCourseEnrollmentsResDto, GetTraineeEnrollmentsQueryDto } from '~/routes/subject/subject.dto'

import { SubjectService } from '~/routes/subject/subject.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('courses')
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly subjectService: SubjectService
  ) {}

  @Get()
  @ZodSerializerDto(GetCoursesResDto)
  async getCourses(@Query() { includeDeleted }: GetCoursesQueryDto, @ActiveRolePermissions('name') roleName: string) {
    return await this.courseService.list({
      includeDeleted,
      activeUserRoleName: roleName
    })
  }

  @Get(':courseId')
  @ZodSerializerDto(GetCourseResDto)
  async getCourseById(@Param() params: GetCourseParamsDto, @Query() { includeDeleted }: GetCoursesQueryDto) {
    return await this.courseService.findById(params.courseId, {
      includeDeleted
    })
  }

  @Post()
  @ZodSerializerDto(CreateCourseResDto)
  async createCourse(
    @Body() createCourseDto: CreateCourseBodyDto,
    @ActiveRolePermissions('name') roleName: string,
    @ActiveUser('userId') userId: string
  ) {
    return await this.courseService.create({
      data: createCourseDto,
      createdById: userId,
      createdByRoleName: roleName
    })
  }

  @Put(':courseId')
  @ZodSerializerDto(UpdateCourseResDto)
  async updateCourse(
    @Param() params: GetCourseParamsDto,
    @Body() updateCourseDto: UpdateCourseBodyDto,
    @ActiveRolePermissions('name') roleName: string,
    @ActiveUser('userId') userId: string
  ) {
    return await this.courseService.update({
      id: params.courseId,
      data: updateCourseDto,
      updatedById: userId,
      updatedByRoleName: roleName
    })
  }

  @Patch(':courseId/archive')
  @ZodSerializerDto(MessageResDTO)
  async archiveCourse(
    @Param() params: GetCourseParamsDto,
    @ActiveRolePermissions('name') roleName: string,
    @ActiveUser('userId') userId: string
  ) {
    return await this.courseService.archive({
      id: params.courseId,
      deletedById: userId,
      deletedByRoleName: roleName
    })
  }

  @Get(':courseId/trainees')
  @ZodSerializerDto(GetCourseTraineesResDto)
  async getCourseTrainees(
    @Param() params: GetCourseParamsDto,
    @Query() query: GetCourseTraineesQueryDto,
    @ActiveRolePermissions('name') _roleName: string
  ) {
    return await this.courseService.getCourseTrainees({
      params,
      query
    })
  }

  @Delete(':courseId/trainees/:traineeId')
  @ZodSerializerDto(CancelCourseEnrollmentsResDto)
  async cancelCourseEnrollments(
    @Param() params: GetCourseParamsDto,
    @Param('traineeId') traineeId: string,
    @Body() body: CancelCourseEnrollmentsBodyDto
  ) {
    return await this.courseService.cancelCourseEnrollments({
      params,
      traineeId,
      data: body
    })
  }

  @Get('trainees/:traineeId/enrollments')
  @ZodSerializerDto(GetTraineeEnrollmentsResDto)
  async getTraineeEnrollments(@Param('traineeId') traineeId: string, @Query() query: GetTraineeEnrollmentsQueryDto) {
    return await this.subjectService.getTraineeEnrollments({
      traineeId,
      query
    })
  }
}

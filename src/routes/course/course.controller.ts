import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  AssignCourseExaminerBodyDto,
  AssignCourseExaminerResDto,
  AssignCourseTrainerBodyDto,
  AssignCourseTrainerResDto,
  CancelCourseEnrollmentsBodyDto,
  CourseTrainerParamsDto,
  CreateCourseBodyDto,
  CreateCourseResDto,
  GetCourseParamsDto,
  GetCourseResDto,
  GetCoursesQueryDto,
  GetCoursesResDto,
  GetCourseTraineesQueryDto,
  GetCourseTraineesResDto,
  UpdateCourseBodyDto,
  UpdateCourseResDto,
  UpdateCourseTrainerAssignmentBodyDto,
  UpdateCourseTrainerAssignmentResDto
} from '~/routes/course/course.dto'
import { CourseService } from '~/routes/course/course.service'
import {
  CancelCourseEnrollmentsResDto,
  GetTraineeEnrollmentsQueryDto,
  GetTraineeEnrollmentsResDto
} from '~/routes/subject/subject.dto'

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

  @Delete(':courseId/archive')
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

  @Post(':courseId/examiners')
  @ZodSerializerDto(AssignCourseExaminerResDto)
  async assignExaminer(@Param() params: GetCourseParamsDto, @Body() body: AssignCourseExaminerBodyDto) {
    return await this.courseService.assignExaminerToCourse({
      courseId: params.courseId,
      data: body
    })
  }

  @Post(':courseId/trainers')
  @ZodSerializerDto(AssignCourseTrainerResDto)
  async assignTrainer(@Param() params: GetCourseParamsDto, @Body() body: AssignCourseTrainerBodyDto) {
    return await this.courseService.assignTrainerToCourse({
      courseId: params.courseId,
      data: body
    })
  }

  @Put(':courseId/trainers/:trainerId')
  @ZodSerializerDto(UpdateCourseTrainerAssignmentResDto)
  async updateTrainerAssignment(
    @Param() params: CourseTrainerParamsDto,
    @Body() body: UpdateCourseTrainerAssignmentBodyDto
  ) {
    return await this.courseService.updateCourseTrainerAssignment({
      courseId: params.courseId,
      trainerId: params.trainerId,
      data: body
    })
  }

  @Delete(':courseId/trainers/:trainerId')
  @ZodSerializerDto(MessageResDTO)
  async removeTrainer(@Param() params: CourseTrainerParamsDto) {
    return await this.courseService.removeTrainerFromCourse({
      courseId: params.courseId,
      trainerId: params.trainerId
    })
  }

  @Get(':courseId/trainees')
  @ZodSerializerDto(GetCourseTraineesResDto)
  async getCourseTrainees(@Param() params: GetCourseParamsDto, @Query() query: GetCourseTraineesQueryDto) {
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

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  AssignCourseTrainerBodyDto,
  AssignCourseTrainerResDto,
  CancelCourseEnrollmentsBodyDto,
  CourseTrainerParamsDto,
  CreateCourseBodyDto,
  CreateCourseResDto,
  GetCourseParamsDto,
  GetCourseResDto,
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
  CourseBatchParamsDto,
  GetCourseEnrollmentBatchesResDto,
  GetTraineeEnrollmentsQueryDto,
  GetTraineeEnrollmentsResDto,
  RemoveCourseEnrollmentsByBatchResDto
} from '~/routes/subject/subject.dto'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @ZodSerializerDto(GetCoursesResDto)
  async list() {
    return await this.courseService.list()
  }

  @Get(':courseId')
  @ZodSerializerDto(GetCourseResDto)
  async findById(@Param() params: GetCourseParamsDto) {
    return await this.courseService.findById(params.courseId)
  }

  @Get(':courseId/enrollments/batches')
  @ZodSerializerDto(GetCourseEnrollmentBatchesResDto)
  async getCourseEnrollmentBatches(@Param() params: GetCourseParamsDto) {
    return await this.courseService.getCourseEnrollmentBatches({
      courseId: params.courseId
    })
  }

  @Post()
  @ZodSerializerDto(CreateCourseResDto)
  async create(
    @Body() body: CreateCourseBodyDto,
    @ActiveRolePermissions('name') roleName: string,
    @ActiveUser('userId') userId: string
  ) {
    return await this.courseService.create({
      data: body,
      createdById: userId,
      createdByRoleName: roleName
    })
  }

  @Put(':courseId')
  @ZodSerializerDto(UpdateCourseResDto)
  async update(
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

  @Delete(':courseId/enrollments/batches/:batchCode')
  @ZodSerializerDto(RemoveCourseEnrollmentsByBatchResDto)
  async removeCourseEnrollmentsByBatch(@Param() params: CourseBatchParamsDto) {
    return await this.courseService.removeCourseEnrollmentsByBatch({
      courseId: params.courseId,
      batchCode: params.batchCode
    })
  }

  @Get('trainees/:traineeId/enrollments')
  @ZodSerializerDto(GetTraineeEnrollmentsResDto)
  async getTraineeEnrollments(@Param('traineeId') traineeId: string, @Query() query: GetTraineeEnrollmentsQueryDto) {
    return await this.courseService.getTraineeEnrollments({
      traineeId,
      query
    })
  }
}

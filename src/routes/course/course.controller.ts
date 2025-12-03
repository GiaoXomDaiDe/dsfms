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
  GetCourseTraineeEnrollmentsQueryDto,
  GetCourseTraineeEnrollmentsResDto,
  GetCourseTraineesQueryDto,
  GetCourseTraineesResDto,
  UpdateCourseBodyDto,
  UpdateCourseResDto,
  UpdateCourseTrainerRoleBodyDto,
  UpdateCourseTrainerRoleResDto
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

  @Post()
  @ZodSerializerDto(CreateCourseResDto)
  async create(@Body() body: CreateCourseBodyDto, @ActiveUser('userId') userId: string) {
    return await this.courseService.create({
      data: body,
      createdById: userId
    })
  }

  @Put(':courseId')
  @ZodSerializerDto(UpdateCourseResDto)
  async update(
    @Param() params: GetCourseParamsDto,
    @Body() updateCourseDto: UpdateCourseBodyDto,
    @ActiveUser('userId') userId: string
  ) {
    return await this.courseService.update({
      id: params.courseId,
      data: updateCourseDto,
      updatedById: userId
    })
  }

  @Delete(':courseId/archive')
  @ZodSerializerDto(MessageResDTO)
  async archive(@Param() params: GetCourseParamsDto, @ActiveUser('userId') userId: string) {
    return await this.courseService.archive({
      id: params.courseId,
      deletedById: userId
    })
  }

  //Assign Trainers
  @Post(':courseId/trainers')
  @ZodSerializerDto(AssignCourseTrainerResDto)
  async assignTrainer(@Param() params: GetCourseParamsDto, @Body() body: AssignCourseTrainerBodyDto) {
    return await this.courseService.assignTrainerToCourse({
      courseId: params.courseId,
      data: body
    })
  }

  @Put(':courseId/trainers/:trainerId')
  @ZodSerializerDto(UpdateCourseTrainerRoleResDto)
  async updateTrainerRole(@Param() params: CourseTrainerParamsDto, @Body() body: UpdateCourseTrainerRoleBodyDto) {
    return await this.courseService.updateCourseTrainerRole({
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

  //Enroll Trainees
  //Active trainee bên subject

  @Get(':courseId/enrollments/batches')
  @ZodSerializerDto(GetCourseEnrollmentBatchesResDto)
  async getCourseEnrollmentBatches(@Param() params: GetCourseParamsDto) {
    return await this.courseService.getCourseEnrollmentBatches({
      courseId: params.courseId
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

  @Get(':courseId/trainees/enrollments')
  @ZodSerializerDto(GetCourseTraineeEnrollmentsResDto)
  async getCourseTraineeEnrollments(
    @Param() params: GetCourseParamsDto,
    @Query() query: GetCourseTraineeEnrollmentsQueryDto
  ) {
    return await this.courseService.getCourseTraineeEnrollments({
      courseId: params.courseId,
      query
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
}

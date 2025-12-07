import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  AssignCourseTrainerBodyDto,
  AssignCourseTrainerResDto,
  CourseTrainerParamsDto,
  CreateCourseBodyDto,
  CreateCourseResDto,
  GetCourseEnrollmentBatchesResDto,
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
import { CourseMes } from '~/routes/course/course.message'
import { CourseService } from '~/routes/course/course.service'
import { CourseBatchParamsDto, RemoveCourseEnrollmentsByBatchResDto } from '~/routes/subject/subject.dto'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get()
  @ZodSerializerDto(GetCoursesResDto)
  async list() {
    const data = await this.courseService.list()
    return {
      message: CourseMes.LIST_SUCCESS,
      data
    }
  }

  @Get(':courseId')
  @ZodSerializerDto(GetCourseResDto)
  async findById(@Param() params: GetCourseParamsDto) {
    const data = await this.courseService.findById(params.courseId)
    return {
      message: CourseMes.DETAIL_SUCCESS,
      data
    }
  }

  @Post()
  @ZodSerializerDto(CreateCourseResDto)
  async create(@Body() body: CreateCourseBodyDto, @ActiveUser('userId') userId: string) {
    const data = await this.courseService.create({
      data: body,
      createdById: userId
    })
    return {
      message: CourseMes.CREATE_SUCCESS,
      data
    }
  }

  @Put(':courseId')
  @ZodSerializerDto(UpdateCourseResDto)
  async update(
    @Param() params: GetCourseParamsDto,
    @Body() updateCourseDto: UpdateCourseBodyDto,
    @ActiveUser('userId') userId: string
  ) {
    const data = await this.courseService.update({
      id: params.courseId,
      data: updateCourseDto,
      updatedById: userId
    })
    return {
      message: CourseMes.UPDATE_SUCCESS,
      data
    }
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
    const data = await this.courseService.assignTrainerToCourse({
      courseId: params.courseId,
      data: body
    })
    return {
      message: CourseMes.ASSIGN_TRAINER_SUCCESS,
      data
    }
  }

  @Put(':courseId/trainers/:trainerId')
  @ZodSerializerDto(UpdateCourseTrainerRoleResDto)
  async updateTrainerRole(@Param() params: CourseTrainerParamsDto, @Body() body: UpdateCourseTrainerRoleBodyDto) {
    const data = await this.courseService.updateCourseTrainerRole({
      courseId: params.courseId,
      trainerId: params.trainerId,
      data: body
    })
    return {
      message: CourseMes.UPDATE_TRAINER_ROLE_SUCCESS,
      data
    }
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

  //Lấy ra các trainees của 1 course
  @Get(':courseId/trainees')
  @ZodSerializerDto(GetCourseTraineesResDto)
  async getTraineesInCourse(@Param() params: GetCourseParamsDto, @Query() query: GetCourseTraineesQueryDto) {
    const data = await this.courseService.getTraineesInCourse({
      params,
      query
    })
    return {
      message: CourseMes.TRAINEES_SUCCESS,
      data
    }
  }

  @Get(':courseId/trainees/:traineeId/enrollments')
  @ZodSerializerDto(GetCourseTraineeEnrollmentsResDto)
  async getTraineeEnrollments(
    @Param() params: GetCourseParamsDto,
    @Param('traineeId') traineeId: string,
    @Query() query: GetCourseTraineeEnrollmentsQueryDto
  ) {
    const data = await this.courseService.getTraineeEnrollments({
      courseId: params.courseId,
      traineeId,
      query
    })
    return {
      message: CourseMes.TRAINEE_ENROLLMENTS_SUCCESS,
      data
    }
  }

  @Delete(':courseId/enrollments/batches/:batchCode')
  @ZodSerializerDto(RemoveCourseEnrollmentsByBatchResDto)
  async removeCourseEnrollmentsByBatch(@Param() params: CourseBatchParamsDto) {
    const data = await this.courseService.removeCourseEnrollmentsByBatch({
      courseId: params.courseId,
      batchCode: params.batchCode
    })
    return {
      message: CourseMes.REMOVE_COURSE_ENROLLMENTS_BY_BATCH_SUCCESS,
      data
    }
  }
}

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import {
  AssignTraineesBodyDto,
  AssignTraineesResDto,
  AssignTrainerBodyDto,
  AssignTrainerResDto,
  BulkCreateSubjectsBodyDto,
  BulkCreateSubjectsResDto,
  CancelSubjectEnrollmentBodyDto,
  CreateSubjectBodyDto,
  GetActiveTraineesResDto,
  GetAvailableTrainersResDto,
  GetSubjectDetailResDto,
  GetSubjectsQueryDto,
  GetSubjectsResDto,
  GetTraineeCourseSubjectsResDto,
  GetTraineeEnrollmentsQueryDto,
  GetTraineeEnrollmentsResDto,
  LookupTraineesBodyDto,
  LookupTraineesResDto,
  RemoveCourseTraineeEnrollmentsBodyDto,
  RemoveCourseTraineeEnrollmentsResDto,
  RemoveEnrollmentsBodyDto,
  RemoveEnrollmentsResDto,
  SubjectIdParamsDto,
  SubjectSchemaDto,
  SubjectTraineeParamsDto,
  SubjectTrainerParamsDto,
  TraineeIdParamsDto,
  UpdateSubjectBodyDto,
  UpdateTrainerAssignmentBodyDto,
  UpdateTrainerAssignmentResDto
} from '~/routes/subject/subject.dto'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'
import { CourseIdParamsDto } from '~/shared/dtos/shared-course.dto'
import { SubjectService } from './subject.service'

@Controller('subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get()
  @ZodSerializerDto(GetSubjectsResDto)
  async list(@Query() query: GetSubjectsQueryDto, @ActiveRolePermissions('name') roleName: string) {
    return await this.subjectService.list(query, roleName)
  }

  @Get('active-trainees')
  @ZodSerializerDto(GetActiveTraineesResDto)
  async getActiveTrainees() {
    return await this.subjectService.getActiveTrainees()
  }

  @Get(':subjectId')
  @ZodSerializerDto(GetSubjectDetailResDto)
  async findByIds(@Param() { subjectId }: SubjectIdParamsDto, @ActiveRolePermissions('name') roleName: string) {
    return await this.subjectService.findById(subjectId, { roleName })
  }

  @Get('courses/:courseId/available-trainers')
  @ZodSerializerDto(GetAvailableTrainersResDto)
  async getAvailableTrainers(@Param() { courseId }: CourseIdParamsDto) {
    return await this.subjectService.getAvailableTrainers(courseId)
  }

  @Post()
  @ZodSerializerDto(SubjectSchemaDto)
  async create(@Body() createSubjectDto: CreateSubjectBodyDto, @ActiveUser('userId') userId: string) {
    return await this.subjectService.create({
      data: createSubjectDto,
      createdById: userId
    })
  }

  @Post('bulk')
  @ZodSerializerDto(BulkCreateSubjectsResDto)
  async bulkCreate(@Body() bulkCreateDto: BulkCreateSubjectsBodyDto, @ActiveUser('userId') userId: string) {
    return await this.subjectService.bulkCreate({
      data: bulkCreateDto,
      createdById: userId
    })
  }

  @Put(':subjectId')
  @ZodSerializerDto(GetSubjectDetailResDto)
  async update(
    @Param() { subjectId }: SubjectIdParamsDto,
    @Body() updateSubjectDto: UpdateSubjectBodyDto,
    @ActiveUser('userId') userId: string
  ) {
    return await this.subjectService.update({
      id: subjectId,
      data: updateSubjectDto,
      updatedById: userId
    })
  }

  @Delete(':subjectId/archive')
  @ZodSerializerDto(MessageResDTO)
  async archive(@Param() { subjectId }: SubjectIdParamsDto, @ActiveUser('userId') userId: string) {
    return await this.subjectService.archive({
      id: subjectId,
      archivedById: userId
    })
  }

  @Post(':subjectId/trainers')
  @ZodSerializerDto(AssignTrainerResDto)
  async assignTrainer(@Param() { subjectId }: SubjectIdParamsDto, @Body() body: AssignTrainerBodyDto) {
    return await this.subjectService.assignTrainer({
      subjectId,
      data: body
    })
  }

  //Cập nhật role của trainer trong subject (chỉ role, không đổi trainer hay subject)
  //Để đổi trainer/subject, sử dụng DELETE + POST operations
  @Put(':subjectId/trainers/:trainerId')
  @ZodSerializerDto(UpdateTrainerAssignmentResDto)
  async updateTrainerAssignment(
    @Param() { subjectId, trainerId }: SubjectTrainerParamsDto,
    @Body() body: UpdateTrainerAssignmentBodyDto
  ) {
    return await this.subjectService.updateTrainerAssignment({
      currentSubjectId: subjectId,
      currentTrainerId: trainerId,
      data: body
    })
  }

  @Delete(':subjectId/trainers/:trainerId')
  @ZodSerializerDto(MessageResDTO)
  async removeTrainer(@Param() { subjectId, trainerId }: SubjectTrainerParamsDto) {
    return await this.subjectService.removeTrainer({
      subjectId,
      trainerId
    })
  }

  @Delete(':subjectId/enrollments')
  @ZodSerializerDto(RemoveEnrollmentsResDto)
  async removeEnrollments(@Param() { subjectId }: SubjectIdParamsDto, @Body() body: RemoveEnrollmentsBodyDto) {
    return await this.subjectService.removeEnrollments({
      subjectId,
      data: body
    })
  }

  @Get('trainees/:traineeId/enrollments')
  @ZodSerializerDto(GetTraineeEnrollmentsResDto)
  async getTraineeEnrollments(
    @Param('traineeId') { traineeId }: TraineeIdParamsDto,
    @Query() query: GetTraineeEnrollmentsQueryDto
  ) {
    return await this.subjectService.getTraineeEnrollments({
      traineeId,
      query
    })
  }

  // API phục vụ dashboard trainee: gom các môn (PLANNED, ENROLLED) theo course cha để hiển thị lịch học
  @Get('trainees/:traineeId/course-subjects')
  @IsPublic()
  @ZodSerializerDto(GetTraineeCourseSubjectsResDto)
  async getTraineeCourseSubjects(@Param() { traineeId }: TraineeIdParamsDto) {
    return await this.subjectService.getTraineeCourseSubjects(traineeId)
  }

  @Post('trainees/lookup')
  @ZodSerializerDto(LookupTraineesResDto)
  async lookupTrainees(@Body() body: LookupTraineesBodyDto) {
    return await this.subjectService.lookupTrainees({
      data: body
    })
  }

  @Delete('courses/trainees/enrollments')
  @ZodSerializerDto(RemoveCourseTraineeEnrollmentsResDto)
  async removeCourseEnrollmentsForTrainee(@Body() body: RemoveCourseTraineeEnrollmentsBodyDto) {
    return await this.subjectService.removeCourseEnrollmentsForTrainee({
      data: body
    })
  }

  @Post(':subjectId/assign-trainees')
  @ZodSerializerDto(AssignTraineesResDto)
  async assignTrainees(@Param() { subjectId }: SubjectIdParamsDto, @Body() body: AssignTraineesBodyDto) {
    return await this.subjectService.assignTraineesToSubject({
      subjectId,
      data: body
    })
  }

  @Delete(':subjectId/trainees/:traineeId')
  @ZodSerializerDto(MessageResDTO)
  async cancelSubjectEnrollment(
    @Param() { subjectId, traineeId }: SubjectTraineeParamsDto,
    @Body() body: CancelSubjectEnrollmentBodyDto
  ) {
    return await this.subjectService.cancelSubjectEnrollment({
      subjectId,
      traineeId,
      data: body
    })
  }
}

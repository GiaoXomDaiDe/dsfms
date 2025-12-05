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
  CreateSubjectResDto,
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
  SubjectTraineeParamsDto,
  SubjectTrainerParamsDto,
  TraineeIdParamsDto,
  UpdateSubjectBodyDto,
  UpdateSubjectResDto,
  UpdateTrainerAssignmentBodyDto,
  UpdateTrainerAssignmentResDto
} from '~/routes/subject/subject.dto'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'
import { SubjectMes } from './subject.message'
import { SubjectService } from './subject.service'

@Controller('subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get()
  @ZodSerializerDto(GetSubjectsResDto)
  async list(@Query() query: GetSubjectsQueryDto) {
    const data = await this.subjectService.list(query)
    return {
      message: SubjectMes.LIST_SUCCESS,
      data
    }
  }

  @Get('courses/active-trainers')
  @ZodSerializerDto(GetAvailableTrainersResDto)
  async getActiveTrainers() {
    const data = await this.subjectService.getActiveTrainers()
    return {
      message: SubjectMes.ACTIVE_TRAINERS_SUCCESS,
      data
    }
  }

  @Get('active-trainees')
  @ZodSerializerDto(GetActiveTraineesResDto)
  async getActiveTrainees() {
    const data = await this.subjectService.getActiveTrainees()
    return {
      message: SubjectMes.ACTIVE_TRAINEES_SUCCESS,
      data
    }
  }

  @Get(':subjectId')
  @ZodSerializerDto(GetSubjectDetailResDto)
  async findByIds(@Param() { subjectId }: SubjectIdParamsDto) {
    const data = await this.subjectService.findById(subjectId)
    return {
      message: SubjectMes.DETAIL_SUCCESS,
      data
    }
  }

  @Post()
  @ZodSerializerDto(CreateSubjectResDto)
  async create(@Body() createSubjectDto: CreateSubjectBodyDto, @ActiveUser('userId') userId: string) {
    const data = await this.subjectService.create({
      data: createSubjectDto,
      createdById: userId
    })
    return {
      message: SubjectMes.CREATE_SUCCESS,
      data
    }
  }

  @Post('bulk')
  @ZodSerializerDto(BulkCreateSubjectsResDto)
  async bulkCreate(@Body() bulkCreateDto: BulkCreateSubjectsBodyDto, @ActiveUser('userId') userId: string) {
    const data = await this.subjectService.bulkCreate({
      data: bulkCreateDto,
      createdById: userId
    })
    return {
      message: SubjectMes.BULK_CREATE_SUCCESS,
      data
    }
  }

  @Put(':subjectId')
  @ZodSerializerDto(UpdateSubjectResDto)
  async update(
    @Param() { subjectId }: SubjectIdParamsDto,
    @Body() updateSubjectDto: UpdateSubjectBodyDto,
    @ActiveUser('userId') userId: string
  ) {
    const data = await this.subjectService.update({
      id: subjectId,
      data: updateSubjectDto,
      updatedById: userId
    })
    return {
      message: SubjectMes.UPDATE_SUCCESS,
      data
    }
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
    const data = await this.subjectService.assignTrainer({
      subjectId,
      data: body
    })
    return {
      message: SubjectMes.ASSIGN_TRAINER_SUCCESS,
      data
    }
  }

  //Cập nhật role của trainer trong subject (chỉ role, không đổi trainer hay subject)
  //Để đổi trainer/subject, sử dụng DELETE + POST operations
  @Put(':subjectId/trainers/:trainerId')
  @ZodSerializerDto(UpdateTrainerAssignmentResDto)
  async updateTrainerAssignment(
    @Param() { subjectId, trainerId }: SubjectTrainerParamsDto,
    @Body() body: UpdateTrainerAssignmentBodyDto
  ) {
    const data = await this.subjectService.updateTrainerAssignment({
      currentSubjectId: subjectId,
      currentTrainerId: trainerId,
      data: body
    })
    return {
      message: SubjectMes.UPDATE_TRAINER_ASSIGNMENT_SUCCESS,
      data
    }
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
    const data = await this.subjectService.removeEnrollments({
      subjectId,
      data: body
    })
    return {
      message: SubjectMes.REMOVE_ENROLLMENTS_SUCCESS,
      data
    }
  }

  @Get('trainees/:traineeId/enrollments')
  @ZodSerializerDto(GetTraineeEnrollmentsResDto)
  async getTraineeEnrollments(
    @Param('traineeId') { traineeId }: TraineeIdParamsDto,
    @Query() query: GetTraineeEnrollmentsQueryDto
  ) {
    const data = await this.subjectService.getTraineeEnrollments({
      traineeId,
      query
    })
    return {
      message: SubjectMes.TRAINEE_ENROLLMENTS_SUCCESS,
      data
    }
  }

  // API phục vụ dashboard trainee: gom các môn (PLANNED, ENROLLED) theo course cha để hiển thị lịch học
  @Get('trainees/:traineeId/course-subjects')
  @IsPublic()
  @ZodSerializerDto(GetTraineeCourseSubjectsResDto)
  async getTraineeCourseSubjects(@Param() { traineeId }: TraineeIdParamsDto) {
    const data = await this.subjectService.getTraineeCourseSubjects(traineeId)
    return {
      message: SubjectMes.TRAINEE_COURSE_SUBJECTS_SUCCESS,
      data
    }
  }

  @Post('trainees/lookup')
  @ZodSerializerDto(LookupTraineesResDto)
  async lookupTrainees(@Body() body: LookupTraineesBodyDto) {
    const data = await this.subjectService.lookupTrainees({
      data: body
    })
    return {
      message: SubjectMes.LOOKUP_TRAINEES_SUCCESS,
      data
    }
  }

  @Delete('courses/trainees/enrollments')
  @ZodSerializerDto(RemoveCourseTraineeEnrollmentsResDto)
  async removeCourseEnrollmentsForTrainee(@Body() body: RemoveCourseTraineeEnrollmentsBodyDto) {
    const data = await this.subjectService.removeCourseEnrollmentsForTrainee({
      data: body
    })
    return {
      message: SubjectMes.REMOVE_COURSE_TRAINEE_ENROLLMENTS_SUCCESS,
      data
    }
  }

  @Post(':subjectId/assign-trainees')
  @ZodSerializerDto(AssignTraineesResDto)
  async assignTrainees(@Param() { subjectId }: SubjectIdParamsDto, @Body() body: AssignTraineesBodyDto) {
    const data = await this.subjectService.assignTraineesToSubject({
      subjectId,
      data: body
    })
    return {
      message: SubjectMes.ASSIGN_TRAINEES_SUCCESS,
      data
    }
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

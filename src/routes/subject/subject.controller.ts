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
  CancelSubjectEnrollmentResDto,
  CreateSubjectBodyDto,
  GetAvailableTrainersResDto,
  GetSubjectDetailResDto,
  GetSubjectsQueryDto,
  GetSubjectsResDto,
  LookupTraineesBodyDto,
  LookupTraineesResDto,
  RemoveEnrollmentsBodyDto,
  RemoveEnrollmentsResDto,
  SubjectIdParamsDto,
  SubjectSchemaDto,
  SubjectTraineeParamsDto,
  SubjectTrainerParamsDto,
  UpdateSubjectBodyDto,
  UpdateTrainerAssignmentBodyDto,
  UpdateTrainerAssignmentResDto
} from '~/routes/subject/subject.dto'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
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

  @Get(':subjectId')
  @ZodSerializerDto(GetSubjectDetailResDto)
  async getSubjectDetails(
    @Param('subjectId') { subjectId }: SubjectIdParamsDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.findById(subjectId, { roleName })
  }

  @Get('courses/:courseId/available-trainers')
  @ZodSerializerDto(GetAvailableTrainersResDto)
  async getAvailableTrainers(@Param('courseId') { courseId }: CourseIdParamsDto) {
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
    @Param('subjectId') { subjectId }: SubjectIdParamsDto,
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
  async archive(@Param('subjectId') { subjectId }: SubjectIdParamsDto, @ActiveUser('userId') userId: string) {
    return await this.subjectService.archive({
      id: subjectId,
      archivedById: userId
    })
  }

  @Post(':subjectId/trainers')
  @ZodSerializerDto(AssignTrainerResDto)
  async assignTrainer(@Param('subjectId') { subjectId }: SubjectIdParamsDto, @Body() body: AssignTrainerBodyDto) {
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

  /**
   * API: Remove Enrollments from Subject
   * DELETE /subjects/:subjectId/enrollments
   * Xóa trainees khỏi subject
   */
  @Delete(':subjectId/enrollments')
  @ZodSerializerDto(RemoveEnrollmentsResDto)
  async removeEnrollments(
    @Param('subjectId') { subjectId }: SubjectIdParamsDto,
    @Body() body: RemoveEnrollmentsBodyDto
  ) {
    return await this.subjectService.removeEnrollments({
      subjectId,
      data: body
    })
  }

  @Post('trainees/lookup')
  @ZodSerializerDto(LookupTraineesResDto)
  async lookupTrainees(@Body() body: LookupTraineesBodyDto) {
    return await this.subjectService.lookupTrainees({
      data: body
    })
  }

  @Post(':subjectId/assign-trainees')
  @ZodSerializerDto(AssignTraineesResDto)
  async assignTrainees(@Param('subjectId') { subjectId }: SubjectIdParamsDto, @Body() body: AssignTraineesBodyDto) {
    return await this.subjectService.assignTraineesToSubject({
      subjectId,
      data: body
    })
  }

  /**
   * API: Cancel Specific Subject Enrollment
   * DELETE /subjects/:subjectId/trainees/:traineeId
   * Hủy enrollment của trainee trong subject cụ thể
   */
  @Delete(':subjectId/trainees/:traineeId')
  @ZodSerializerDto(CancelSubjectEnrollmentResDto)
  async cancelSubjectEnrollment(
    @Param() { subjectId, traineeId }: SubjectTraineeParamsDto,
    @Body() body: CancelSubjectEnrollmentBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.cancelSubjectEnrollment({
      subjectId,
      traineeId,
      data: body,
      roleName
    })
  }
}

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
  EnrollTraineesBodyDto,
  EnrollTraineesResDto,
  GetAvailableTrainersQueryDto,
  GetAvailableTrainersResDto,
  GetSubjectsQueryDto,
  GetSubjectsResDto,
  LookupTraineesBodyDto,
  LookupTraineesResDto,
  RemoveEnrollmentsBodyDto,
  RemoveEnrollmentsResDto,
  RemoveTrainerResDto,
  SubjectDetailResDto,
  SubjectResDto,
  UpdateSubjectBodyDto,
  UpdateTrainerAssignmentBodyDto,
  UpdateTrainerAssignmentResDto
} from '~/routes/subject/subject.dto'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'

import { SubjectService } from './subject.service'

@Controller('subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get()
  @ZodSerializerDto(GetSubjectsResDto)
  async getAllSubjects(@Query() query: GetSubjectsQueryDto) {
    return await this.subjectService.list(query)
  }

  @Post()
  @ZodSerializerDto(SubjectResDto)
  async createSubject(
    @Body() createSubjectDto: CreateSubjectBodyDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.create({
      data: createSubjectDto,
      createdById: userId,
      createdByRoleName: roleName
    })
  }

  /**
   * API: Bulk Create Subjects
   * POST /subjects/bulk
   * Tạo nhiều subjects cùng lúc cho một course
   */
  @Post('bulk')
  @ZodSerializerDto(BulkCreateSubjectsResDto)
  async bulkCreateSubjects(
    @Body() bulkCreateDto: BulkCreateSubjectsBodyDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.bulkCreate({
      data: bulkCreateDto,
      createdById: userId,
      createdByRoleName: roleName
    })
  }

  /**
   * API: Get Subject Details + List Trainers with role
   * GET /subjects/:subjectId
   * Lấy thông tin chi tiết subject kèm danh sách trainers và role của họ
   */
  @Get(':subjectId')
  @ZodSerializerDto(SubjectDetailResDto)
  async getSubjectDetailsWithTrainers(
    @Param('subjectId') subjectId: string,
    @ActiveRolePermissions('name') roleName: string,
    @Query('includeDeleted') includeDeleted?: string
  ) {
    return await this.subjectService.findById(subjectId, {
      includeDeleted: includeDeleted === 'true'
    })
  }

  /**
   * API: Update a Subject
   * PUT /subjects/:subjectId
   * Cập nhật thông tin subject
   */
  @Put(':subjectId')
  @ZodSerializerDto(SubjectResDto)
  async updateSubject(
    @Param('subjectId') subjectId: string,
    @Body() updateSubjectDto: UpdateSubjectBodyDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.update({
      id: subjectId,
      data: updateSubjectDto,
      updatedById: userId,
      updatedByRoleName: roleName
    })
  }

  /**
   * API: Remove a Subject (Soft Delete)
   * DELETE /subjects/:subjectId
   * Xóa mềm subject
   */
  @Delete(':subjectId')
  @ZodSerializerDto(MessageResDTO)
  async removeSubject(
    @Param('subjectId') subjectId: string,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.delete({
      id: subjectId,
      deletedById: userId,
      deletedByRoleName: roleName
    })
  }

  /**
   * API: Archive a Subject
   * POST /subjects/:subjectId/archive
   * Archive subject bằng cách đổi status sang ARCHIVED
   */
  @Post(':subjectId/archive')
  @ZodSerializerDto(SubjectResDto)
  async archiveSubject(
    @Param('subjectId') subjectId: string,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.archive({
      id: subjectId,
      archivedById: userId,
      archivedByRoleName: roleName
    })
  }

  /**
   * API: Restore a Subject
   * PUT /subjects/:subjectId/restore
   * Khôi phục subject đã bị xóa mềm
   */
  @Put(':subjectId/restore')
  @ZodSerializerDto(MessageResDTO)
  async restoreSubject(
    @Param('subjectId') subjectId: string,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.restore({
      id: subjectId,
      restoredById: userId,
      restoredByRoleName: roleName
    })
  }

  /**
   * API: Enroll Trainees to Subject
   * POST /subjects/:subjectId/enrollments
   * Ghi danh trainees vào subject
   */
  @Post(':subjectId/enrollments')
  @ZodSerializerDto(EnrollTraineesResDto)
  async enrollTrainees(
    @Param('subjectId') subjectId: string,
    @Body() body: EnrollTraineesBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.enrollTrainees({
      subjectId,
      data: body,
      roleName
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
    @Param('subjectId') subjectId: string,
    @Body() body: RemoveEnrollmentsBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.removeEnrollments({
      subjectId,
      data: body,
      roleName
    })
  }

  // ========================================
  // TRAINER ASSIGNMENT ENDPOINTS
  // ========================================

  /**
   * API: Get Available Trainers for Course
   * GET /courses/:courseId/available-trainers
   * Lấy danh sách trainers có sẵn trong department chưa được assign vào bất kỳ subject nào của course
   */
  @Get('courses/:courseId/available-trainers')
  @ZodSerializerDto(GetAvailableTrainersResDto)
  async getAvailableTrainers(
    @Param('courseId') courseId: string,
    @Query() query: GetAvailableTrainersQueryDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.getAvailableTrainers({
      departmentId: query.departmentId,
      courseId,
      roleName
    })
  }

  /**
   * API: Assign Trainer to Subject
   * POST /subjects/:subjectId/trainers
   * Gán trainer vào subject với role cụ thể
   */
  @Post(':subjectId/trainers')
  @ZodSerializerDto(AssignTrainerResDto)
  async assignTrainer(
    @Param('subjectId') subjectId: string,
    @Body() body: AssignTrainerBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.assignTrainer({
      subjectId,
      data: body,
      roleName
    })
  }

  /**
   * API: Update Trainer Role in Subject
   * PUT /subjects/:subjectId/trainers/:trainerId
   * Cập nhật role của trainer trong subject (chỉ role, không đổi trainer hay subject)
   * Để đổi trainer/subject, sử dụng DELETE + POST operations
   */
  @Put(':subjectId/trainers/:trainerId')
  @ZodSerializerDto(UpdateTrainerAssignmentResDto)
  async updateTrainerAssignment(
    @Param('subjectId') subjectId: string,
    @Param('trainerId') trainerId: string,
    @Body() body: UpdateTrainerAssignmentBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.updateTrainerAssignment({
      currentSubjectId: subjectId,
      currentTrainerId: trainerId,
      data: body,
      roleName
    })
  }

  /**
   * API: Remove Trainer from Subject
   * DELETE /subjects/:subjectId/trainers/:trainerId
   * Xóa trainer khỏi subject
   */
  @Delete(':subjectId/trainers/:trainerId')
  @ZodSerializerDto(RemoveTrainerResDto)
  async removeTrainer(
    @Param('subjectId') subjectId: string,
    @Param('trainerId') trainerId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.removeTrainer({
      subjectId,
      trainerId,
      roleName
    })
  }

  // ========================================
  // TRAINEE ASSIGNMENT ENDPOINTS
  // ========================================

  /**
   * API: Lookup Trainees
   * POST /trainees/lookup
   * Tra cứu trainees theo EID hoặc email (bulk import support)
   */
  @Post('trainees/lookup')
  @ZodSerializerDto(LookupTraineesResDto)
  async lookupTrainees(@Body() body: LookupTraineesBodyDto) {
    return await this.subjectService.lookupTrainees({
      data: body
    })
  }

  /**
   * API: Assign Trainees to Subject
   * POST /subjects/:subjectId/assign-trainees
   * Gán nhiều trainees vào subject với validation đầy đủ
   */
  @Post(':subjectId/assign-trainees')
  @ZodSerializerDto(AssignTraineesResDto)
  async assignTrainees(
    @Param('subjectId') subjectId: string,
    @Body() body: AssignTraineesBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.assignTraineesToSubject({
      subjectId,
      data: body,
      roleName
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
    @Param('subjectId') subjectId: string,
    @Param('traineeId') traineeId: string,
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

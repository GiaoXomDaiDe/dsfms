import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { MessageResDTO } from '~/shared/dtos/response.dto'
import {
  AssignTraineesBodyDto,
  AssignTraineesResDto,
  AssignTrainerBodyDto,
  AssignTrainerResDto,
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
} from './subject.model'
import { SubjectService } from './subject.service'

@Controller('subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

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
   * API: Get Subject Details + List Trainers with role
   * GET /subjects/:id
   * Lấy thông tin chi tiết subject kèm danh sách trainers và role của họ
   */
  @Get(':id')
  @ZodSerializerDto(SubjectDetailResDto)
  async getSubjectDetailsWithTrainers(
    @Param('id') id: string,
    @ActiveRolePermissions('name') roleName: string,
    @Query('includeDeleted') includeDeleted?: string
  ) {
    return await this.subjectService.findById(id, {
      includeDeleted: includeDeleted === 'true'
    })
  }

  /**
   * API: Update a Subject
   * PUT /subjects/:id
   * Cập nhật thông tin subject
   */
  @Put(':id')
  @ZodSerializerDto(SubjectResDto)
  async updateSubject(
    @Param('id') id: string,
    @Body() updateSubjectDto: UpdateSubjectBodyDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.update({
      id,
      data: updateSubjectDto,
      updatedById: userId,
      updatedByRoleName: roleName
    })
  }

  /**
   * API: Remove a Subject (Soft Delete)
   * DELETE /subjects/:id
   * Xóa mềm subject
   */
  @Delete(':id')
  @ZodSerializerDto(MessageResDTO)
  async removeSubject(
    @Param('id') id: string,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.delete({
      id,
      deletedById: userId,
      deletedByRoleName: roleName
    })
  }

  /**
   * API: Archive a Subject
   * POST /subjects/:id/archive
   * Archive subject bằng cách đổi status sang ARCHIVED
   */
  @Post(':id/archive')
  @ZodSerializerDto(SubjectResDto)
  async archiveSubject(
    @Param('id') id: string,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.archive({
      id,
      archivedById: userId,
      archivedByRoleName: roleName
    })
  }

  /**
   * API: Get All Subjects (with filters and pagination)
   * GET /subjects
   * Lấy danh sách subjects với filter và phân trang
   */
  @Get()
  @ZodSerializerDto(GetSubjectsResDto)
  async getAllSubjects(@Query() query: GetSubjectsQueryDto, @ActiveRolePermissions('name') roleName: string) {
    return await this.subjectService.list(query)
  }

  /**
   * API: Restore a Subject
   * PUT /subjects/:id/restore
   * Khôi phục subject đã bị xóa mềm
   */
  @Put(':id/restore')
  @ZodSerializerDto(MessageResDTO)
  async restoreSubject(
    @Param('id') id: string,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.restore({
      id,
      restoredById: userId,
      restoredByRoleName: roleName
    })
  }

  /**
   * API: Enroll Trainees to Subject
   * POST /subjects/:id/enrollments
   * Ghi danh trainees vào subject
   */
  @Post(':id/enrollments')
  @ZodSerializerDto(EnrollTraineesResDto)
  async enrollTrainees(
    @Param('id') id: string,
    @Body() body: EnrollTraineesBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.enrollTrainees({
      subjectId: id,
      data: body,
      roleName
    })
  }

  /**
   * API: Remove Enrollments from Subject
   * DELETE /subjects/:id/enrollments
   * Xóa trainees khỏi subject
   */
  @Delete(':id/enrollments')
  @ZodSerializerDto(RemoveEnrollmentsResDto)
  async removeEnrollments(
    @Param('id') id: string,
    @Body() body: RemoveEnrollmentsBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.removeEnrollments({
      subjectId: id,
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
   * POST /subjects/:id/trainers
   * Gán trainer vào subject với role cụ thể
   */
  @Post(':id/trainers')
  @ZodSerializerDto(AssignTrainerResDto)
  async assignTrainer(
    @Param('id') id: string,
    @Body() body: AssignTrainerBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.assignTrainer({
      subjectId: id,
      data: body,
      roleName
    })
  }

  /**
   * API: Update Trainer Assignment
   * PUT /subjects/:id/trainers/:trainerId
   * Cập nhật trainer assignment (đổi trainer, subject, hoặc role)
   */
  @Put(':id/trainers/:trainerId')
  @ZodSerializerDto(UpdateTrainerAssignmentResDto)
  async updateTrainerAssignment(
    @Param('id') id: string,
    @Param('trainerId') trainerId: string,
    @Body() body: UpdateTrainerAssignmentBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.updateTrainerAssignment({
      currentSubjectId: id,
      currentTrainerId: trainerId,
      data: body,
      roleName
    })
  }

  /**
   * API: Remove Trainer from Subject
   * DELETE /subjects/:id/trainers/:trainerId
   * Xóa trainer khỏi subject
   */
  @Delete(':id/trainers/:trainerId')
  @ZodSerializerDto(RemoveTrainerResDto)
  async removeTrainer(
    @Param('id') id: string,
    @Param('trainerId') trainerId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.removeTrainer({
      subjectId: id,
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
   * POST /subjects/:id/assign-trainees
   * Gán nhiều trainees vào subject với validation đầy đủ
   */
  @Post(':id/assign-trainees')
  @ZodSerializerDto(AssignTraineesResDto)
  async assignTrainees(
    @Param('id') id: string,
    @Body() body: AssignTraineesBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.assignTraineesToSubject({
      subjectId: id,
      data: body,
      roleName
    })
  }

  /**
   * API: Cancel Specific Subject Enrollment
   * DELETE /subjects/:id/trainees/:traineeId
   * Hủy enrollment của trainee trong subject cụ thể
   */
  @Delete(':id/trainees/:traineeId')
  @ZodSerializerDto(CancelSubjectEnrollmentResDto)
  async cancelSubjectEnrollment(
    @Param('id') id: string,
    @Param('traineeId') traineeId: string,
    @Body() body: CancelSubjectEnrollmentBodyDto,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.cancelSubjectEnrollment({
      subjectId: id,
      traineeId,
      data: body,
      roleName
    })
  }
}

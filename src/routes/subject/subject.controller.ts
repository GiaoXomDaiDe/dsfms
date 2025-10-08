import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import {
  BulkCreateSubjectsBodyDto,
  CreateSubjectBodyDto,
  GetSubjectsQueryDto,
  UpdateSubjectBodyDto
} from './subject.model'
import { SubjectService } from './subject.service'

@Controller('subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  /**
   * API: Add A Subject to Course
   * POST /subjects
   * Tạo mới một subject và gán vào course
   */
  @Post()
  async addSubjectToCourse(
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
   * API: Bulk Add Subjects to Course
   * POST /subjects/bulk
   * Tạo nhiều subjects cùng lúc cho một course
   */
  @Post('bulk')
  async bulkAddSubjectsToCourse(
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
   * GET /subjects/:id
   * Lấy thông tin chi tiết subject kèm danh sách trainers và role của họ
   */
  @Get(':id')
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
   * API: Get All Subjects (with filters and pagination)
   * GET /subjects
   * Lấy danh sách subjects với filter và phân trang
   */
  @Get()
  async getAllSubjects(@Query() query: GetSubjectsQueryDto, @ActiveRolePermissions('name') roleName: string) {
    return await this.subjectService.list(query)
  }

  /**
   * API: Get Subjects by Course
   * GET /subjects/course/:courseId
   * Lấy danh sách subjects theo course
   */
  @Get('course/:courseId')
  async getSubjectsByCourse(
    @Param('courseId') courseId: string,
    @ActiveRolePermissions('name') roleName: string,
    @Query('includeDeleted') includeDeleted?: string
  ) {
    return await this.subjectService.getSubjectsByCourse({
      courseId,
      includeDeleted: includeDeleted === 'true'
    })
  }

  /**
   * API: Restore a Subject
   * PUT /subjects/:id/restore
   * Khôi phục subject đã bị xóa mềm
   */
  @Put(':id/restore')
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
   * API: Hard Delete a Subject
   * DELETE /subjects/:id/hard
   * Xóa cứng subject (chỉ dành cho ADMINISTRATOR)
   */
  @Delete(':id/hard')
  async hardDeleteSubject(
    @Param('id') id: string,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions('name') roleName: string
  ) {
    return await this.subjectService.delete({
      id,
      deletedById: userId,
      deletedByRoleName: roleName,
      isHard: true
    })
  }
}

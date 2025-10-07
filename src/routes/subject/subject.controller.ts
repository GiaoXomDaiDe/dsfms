import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
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
  async addSubjectToCourse(@Body() createSubjectDto: CreateSubjectBodyDto) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }

    return await this.subjectService.create({
      data: createSubjectDto,
      createdById: mockUser.id,
      createdByRoleName: mockUser.roleName
    })
  }

  /**
   * API: Bulk Add Subjects to Course
   * POST /subjects/bulk
   * Tạo nhiều subjects cùng lúc cho một course
   */
  @Post('bulk')
  async bulkAddSubjectsToCourse(@Body() bulkCreateDto: BulkCreateSubjectsBodyDto) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }

    return await this.subjectService.bulkCreate({
      data: bulkCreateDto,
      createdById: mockUser.id,
      createdByRoleName: mockUser.roleName
    })
  }

  /**
   * API: Get Subject Details + List Trainers with role
   * GET /subjects/:id
   * Lấy thông tin chi tiết subject kèm danh sách trainers và role của họ
   */
  @Get(':id')
  async getSubjectDetailsWithTrainers(@Param('id') id: string, @Query('includeDeleted') includeDeleted?: string) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { roleName: 'ADMINISTRATOR' }

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
  async updateSubject(@Param('id') id: string, @Body() updateSubjectDto: UpdateSubjectBodyDto) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }

    return await this.subjectService.update({
      id,
      data: updateSubjectDto,
      updatedById: mockUser.id,
      updatedByRoleName: mockUser.roleName
    })
  }

  /**
   * API: Remove a Subject (Soft Delete)
   * DELETE /subjects/:id
   * Xóa mềm subject
   */
  @Delete(':id')
  async removeSubject(@Param('id') id: string) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }

    return await this.subjectService.delete({
      id,
      deletedById: mockUser.id,
      deletedByRoleName: mockUser.roleName
    })
  }

  /**
   * API: Get All Subjects (with filters and pagination)
   * GET /subjects
   * Lấy danh sách subjects với filter và phân trang
   */
  @Get()
  async getAllSubjects(@Query() query: GetSubjectsQueryDto) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { roleName: 'ADMINISTRATOR' }

    return await this.subjectService.list(query)
  }

  /**
   * API: Get Subjects by Course
   * GET /subjects/course/:courseId
   * Lấy danh sách subjects theo course
   */
  @Get('course/:courseId')
  async getSubjectsByCourse(@Param('courseId') courseId: string, @Query('includeDeleted') includeDeleted?: string) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { roleName: 'ADMINISTRATOR' }

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
  async restoreSubject(@Param('id') id: string) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }

    return await this.subjectService.restore({
      id,
      restoredById: mockUser.id,
      restoredByRoleName: mockUser.roleName
    })
  }

  /**
   * API: Hard Delete a Subject
   * DELETE /subjects/:id/hard
   * Xóa cứng subject (chỉ dành cho ADMINISTRATOR)
   */
  @Delete(':id/hard')
  async hardDeleteSubject(@Param('id') id: string) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }

    return await this.subjectService.delete({
      id,
      deletedById: mockUser.id,
      deletedByRoleName: mockUser.roleName,
      isHard: true
    })
  }
}

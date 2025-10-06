import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import {
  AddInstructorsBodyDto,
  BulkCreateSubjectsBodyDto,
  CreateSubjectBodyDto,
  EnrollTraineesBodyDto,
  GetSubjectsQueryDto,
  RemoveEnrollmentsBodyDto,
  RemoveInstructorsBodyDto,
  UpdateEnrollmentStatusBodyDto,
  UpdateSubjectBodyDto
} from './subject.model'
import { SubjectService } from './subject.service'

@Controller('subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get()
  async getSubjects(@Query() query: GetSubjectsQueryDto) {
    return await this.subjectService.list(query)
  }

  @Get('stats')
  async getSubjectStats(@Query('includeDeleted') includeDeleted?: string) {
    return await this.subjectService.getStats({
      includeDeleted: includeDeleted === 'true'
    })
  }

  @Get('course/:courseId')
  async getSubjectsByCourse(@Param('courseId') courseId: string, @Query('includeDeleted') includeDeleted?: string) {
    return await this.subjectService.getSubjectsByCourse({
      courseId,
      includeDeleted: includeDeleted === 'true'
    })
  }

  @Get(':id')
  async getSubjectById(@Param('id') id: string) {
    return await this.subjectService.findById(id)
  }

  @Get(':id/instructors')
  async getSubjectInstructors(@Param('id') id: string) {
    return await this.subjectService.getSubjectInstructors(id)
  }

  @Get(':id/enrollments')
  async getSubjectEnrollments(@Param('id') id: string) {
    return await this.subjectService.getSubjectEnrollments(id)
  }

  @Post()
  async createSubject(@Body() createSubjectDto: CreateSubjectBodyDto) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }
    return await this.subjectService.create({
      data: createSubjectDto,
      createdById: mockUser.id,
      createdByRoleName: mockUser.roleName
    })
  }

  @Post('bulk')
  async bulkCreateSubjects(@Body() bulkCreateDto: BulkCreateSubjectsBodyDto) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }
    return await this.subjectService.bulkCreate({
      data: bulkCreateDto,
      createdById: mockUser.id,
      createdByRoleName: mockUser.roleName
    })
  }

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

  @Delete(':id')
  async deleteSubject(@Param('id') id: string) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }
    return await this.subjectService.delete({
      id,
      deletedById: mockUser.id,
      deletedByRoleName: mockUser.roleName
    })
  }

  @Delete(':id/hard')
  async hardDeleteSubject(@Param('id') id: string) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }
    await this.subjectService.delete({
      id,
      deletedById: mockUser.id,
      deletedByRoleName: mockUser.roleName,
      isHard: true
    })
  }

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

  @Post(':id/instructors')
  async addInstructorsToSubject(@Param('id') id: string, @Body() addInstructorsDto: AddInstructorsBodyDto) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { roleName: 'ADMINISTRATOR' }
    return await this.subjectService.addInstructors({
      subjectId: id,
      instructors: addInstructorsDto.instructors,
      addedByRoleName: mockUser.roleName
    })
  }

  @Delete(':id/instructors')
  async removeInstructorsFromSubject(@Param('id') id: string, @Body() removeInstructorsDto: RemoveInstructorsBodyDto) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { roleName: 'ADMINISTRATOR' }
    return await this.subjectService.removeInstructors({
      subjectId: id,
      trainerEids: removeInstructorsDto.trainerEids,
      removedByRoleName: mockUser.roleName
    })
  }

  @Post(':id/enrollments')
  async enrollTraineesInSubject(@Param('id') id: string, @Body() enrollTraineesDto: EnrollTraineesBodyDto) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { roleName: 'ADMINISTRATOR' }
    return await this.subjectService.enrollTrainees({
      subjectId: id,
      trainees: enrollTraineesDto.trainees,
      enrolledByRoleName: mockUser.roleName
    })
  }

  @Delete(':id/enrollments')
  async removeEnrollmentsFromSubject(@Param('id') id: string, @Body() removeEnrollmentsDto: RemoveEnrollmentsBodyDto) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { roleName: 'ADMINISTRATOR' }
    return await this.subjectService.removeEnrollments({
      subjectId: id,
      traineeEids: removeEnrollmentsDto.traineeEids,
      removedByRoleName: mockUser.roleName
    })
  }

  @Put(':id/enrollments/:traineeEid/status')
  async updateEnrollmentStatus(
    @Param('id') id: string,
    @Param('traineeEid') traineeEid: string,
    @Body() updateStatusDto: UpdateEnrollmentStatusBodyDto
  ) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { roleName: 'ADMINISTRATOR' }
    return await this.subjectService.updateEnrollmentStatus({
      subjectId: id,
      traineeEid,
      status: updateStatusDto.status,
      updatedByRoleName: mockUser.roleName
    })
  }

  @Post(':id/validate-access')
  async validateSubjectAccess(@Param('id') id: string) {
    // Note: In a real implementation, user would come from authentication
    const mockUser = { id: '1', roleName: 'ADMINISTRATOR' }
    const hasAccess = await this.subjectService.validateSubjectAccess({
      subjectId: id,
      userId: mockUser.id,
      userRole: mockUser.roleName
    })

    return { hasAccess }
  }
}

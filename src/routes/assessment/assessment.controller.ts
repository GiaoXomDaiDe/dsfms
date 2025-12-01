import { Body, Controller, Get, Param, Post, Put, Query, Res, Header } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import type { Response } from 'express'
import {
  CreateAssessmentBodyDTO,
  CreateBulkAssessmentBodyDTO,
  CreateAssessmentResDTO,
  CreateBulkAssessmentResDTO,
  GetAssessmentsQueryDTO,
  GetAssessmentParamsDTO,
  GetAssessmentsResDTO,
  GetAssessmentDetailResDTO,
  GetSubjectAssessmentsQueryDTO,
  GetSubjectAssessmentsResDTO,
  GetCourseAssessmentsQueryDTO,
  GetCourseAssessmentsResDTO,
  GetAssessmentSectionsResDTO,
  GetAssessmentSectionFieldsResDTO,
  SaveAssessmentValuesBodyDTO,
  SaveAssessmentValuesResDTO,
  ToggleTraineeLockBodyDTO,
  ToggleTraineeLockResDTO,
  SubmitAssessmentResDTO,
  UpdateAssessmentValuesBodyDTO,
  UpdateAssessmentValuesResDTO,
  ConfirmAssessmentParticipationBodyDTO,
  ConfirmAssessmentParticipationResDTO,
  GetDepartmentAssessmentsQueryDTO,
  GetDepartmentAssessmentsResDTO,
  ApproveRejectAssessmentBodyDTO,
  ApproveRejectAssessmentResDTO,
  RenderDocxTemplateBodyDTO,
  RenderDocxTemplateResDTO,
  GetAssessmentEventsQueryDTO,
  GetAssessmentEventsResDTO,
  GetUserAssessmentEventsQueryDTO,
  GetUserAssessmentEventsResDTO,
  UpdateAssessmentEventBodyDTO,
  UpdateAssessmentEventParamsDTO,
  UpdateAssessmentEventResDTO
} from './assessment.dto'
import { AssessmentService } from './assessment.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { IsPublic } from '~/shared/decorators/auth.decorator'

@Controller('assessments')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  /**
   * POST /assessments
   * Create new assessments for specific trainees based on a template
   */
  @Post()
  @ZodSerializerDto(CreateAssessmentResDTO)
  async createAssessments(
    @Body() body: CreateAssessmentBodyDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.createAssessments(body, userContext)
  }

  /**
   * POST /assessments/bulk
   * Create assessments for ALL enrolled trainees in a course/subject
   */
  @Post('bulk')
  @ZodSerializerDto(CreateBulkAssessmentResDTO)
  async createBulkAssessments(
    @Body() body: CreateBulkAssessmentBodyDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.createBulkAssessments(body, userContext)
  }

  /**
   * GET /assessments/subject
   * List all assessments for a specific subject (for trainers)
   */
  @Get('subject')
  @ZodSerializerDto(GetSubjectAssessmentsResDTO)
  async getSubjectAssessments(
    @Query() query: GetSubjectAssessmentsQueryDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.getSubjectAssessments(query, userContext)
  }

  /**
   * GET /assessments/course
   * List all assessments for a specific course (for trainers)
   */
  @Get('course')
  @ZodSerializerDto(GetCourseAssessmentsResDTO)
  async getCourseAssessments(
    @Query() query: GetCourseAssessmentsQueryDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.getCourseAssessments(query, userContext)
  }

  /**
   * GET /assessments/department
   * List all assessments for a department (for Department Head)
   */
  @Get('department')
  @ZodSerializerDto(GetDepartmentAssessmentsResDTO)
  async getDepartmentAssessments(
    @Query() query: GetDepartmentAssessmentsQueryDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.getDepartmentAssessments(query, userContext)
  }

  /**
   * GET /assessments/events
   * Get assessment events - grouped assessment forms by name, subject/course, occurrence date, and templateId
   */
  @Get('events')
  @ZodSerializerDto(GetAssessmentEventsResDTO)
  async getAssessmentEvents(
    @Query() query: GetAssessmentEventsQueryDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.getAssessmentEvents(query, userContext)
  }

  /**
   * PUT /assessments/events/update
   * Update assessment event basic info (name and/or occurrence date)
   * URL format: /assessments/events/update?subjectId=xxx&occuranceDate=2024-12-01&name=EventName&templateId=xxx
   * OR: /assessments/events/update?courseId=xxx&occuranceDate=2024-12-01&name=EventName&templateId=xxx
   */
  @Put('events/update')
  @ZodSerializerDto(UpdateAssessmentEventResDTO)
  async updateAssessmentEvent(
    @Query() params: UpdateAssessmentEventParamsDTO,
    @Body() body: UpdateAssessmentEventBodyDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.updateAssessmentEvent(params, body, userContext)
  }

  /**
   * GET /assessments/user-events
   * Get assessment events for current user based on their role (TRAINER/TRAINEE) and assignments
   */
  @Get('user-events')
  @ZodSerializerDto(GetUserAssessmentEventsResDTO)
  async getUserAssessmentEvents(
    @Query() query: GetUserAssessmentEventsQueryDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.getUserAssessmentEvents(query, userContext)
  }

  /**
   * GET /assessments
   * List all assessments with pagination and filters
   */
  @Get()
  @ZodSerializerDto(GetAssessmentsResDTO)
  async listAssessments(
    @Query() query: GetAssessmentsQueryDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.list(query, userContext)
  }

  /**
   * GET /assessments/:assessmentId
   * Get detailed information about a specific assessment
   */
  @Get(':assessmentId')
  @ZodSerializerDto(GetAssessmentDetailResDTO)
  async getAssessmentDetail(
    @Param() params: GetAssessmentParamsDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.findById(params.assessmentId, userContext)
  }

  /**
   * GET /assessments/:assessmentId/sections
   * Get assessment sections with permission checking based on user roles
   */
  @Get(':assessmentId/sections')
  @ZodSerializerDto(GetAssessmentSectionsResDTO)
  async getAssessmentSections(
    @Param() params: GetAssessmentParamsDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.getAssessmentSections(params.assessmentId, userContext)
  }

  /**
   * GET /assessments/:assessmentId/trainee-sections
   * Get TRAINEE sections of an assessment form (for viewing by trainers/supervisors)
   */
  @Get(':assessmentId/trainee-sections')
  @ZodSerializerDto(GetAssessmentSectionsResDTO)
  async getTraineeSections(
    @Param() params: GetAssessmentParamsDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.getTraineeSections(params.assessmentId, userContext)
  }

  /**
   * GET /assessments/sections/:assessmentSectionId/fields
   * Get all fields of an assessment section with template field info and assessment values
   */
  @Get('sections/:assessmentSectionId/fields')
  @ZodSerializerDto(GetAssessmentSectionFieldsResDTO)
  async getAssessmentSectionFields(
    @Param('assessmentSectionId') assessmentSectionId: string,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.getAssessmentSectionFields(assessmentSectionId, userContext)
  }

  /**
   * POST /assessments/sections/save-values
   * Save assessment values for a section and update section status
   */
  @Post('sections/save-values')
  @ZodSerializerDto(SaveAssessmentValuesResDTO)
  async saveAssessmentValues(
    @Body() body: SaveAssessmentValuesBodyDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.saveAssessmentValues(body, userContext)
  }

  /**
   * PUT /assessments/:assessmentId/trainee-lock
   * Toggle trainee lock status (only on occurrence date)
   */
  @Put(':assessmentId/trainee-lock')
  @ZodSerializerDto(ToggleTraineeLockResDTO)
  async toggleTraineeLock(
    @Param() params: GetAssessmentParamsDTO,
    @Body() body: ToggleTraineeLockBodyDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.toggleTraineeLock(params.assessmentId, body, userContext)
  }

  /**
   * POST /assessments/:assessmentId/submit
   * Submit assessment (only when ready and user filled submittable sections)
   */
  @Post(':assessmentId/submit')
  @ZodSerializerDto(SubmitAssessmentResDTO)
  async submitAssessment(
    @Param() params: GetAssessmentParamsDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.submitAssessment(params.assessmentId, userContext)
  }

  /**
   * PUT /assessments/sections/update-values
   * Update assessment values (only by original assessor)
   */
  @Put('sections/update-values')
  @ZodSerializerDto(UpdateAssessmentValuesResDTO)
  async updateAssessmentValues(
    @Body() body: UpdateAssessmentValuesBodyDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.updateAssessmentValues(body, userContext)
  }

  /**
   * PUT /assessments/:assessmentId/confirm-participation
   * Confirm trainee participation, save signature, and change status from SIGNATURE_PENDING to READY_TO_SUBMIT
   */
  @Put(':assessmentId/confirm-participation')
  @ZodSerializerDto(ConfirmAssessmentParticipationResDTO)
  async confirmAssessmentParticipation(
    @Param() params: GetAssessmentParamsDTO,
    @Body() body: ConfirmAssessmentParticipationBodyDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.confirmAssessmentParticipation(params.assessmentId, body, userContext)
  }

  /**
   * PUT /assessments/:assessmentId/approve-reject
   * Approve or reject a SUBMITTED assessment form
   */
  @Put(':assessmentId/approve-reject')
  @ZodSerializerDto(ApproveRejectAssessmentResDTO)
  async approveRejectAssessment(
    @Param() params: GetAssessmentParamsDTO,
    @Body() body: ApproveRejectAssessmentBodyDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.approveRejectAssessment(params.assessmentId, body, userContext)
  }

  /**
   * GET /assessments/:assessmentId/pdf-url
   * Get PDF URL of an approved assessment
   */
  @Get(':assessmentId/pdf-url')
  async getAssessmentPdfUrl(
    @Param() params: GetAssessmentParamsDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.assessmentService.getAssessmentPdfUrl(params.assessmentId, userContext)
  }

  /**
   * POST /assessments/render-docx-template
   * Render DOCX template with provided data for testing purposes
   * Public endpoint - no authentication required
   */
  @Post('render-docx-template')
  @IsPublic()
  @ZodSerializerDto(RenderDocxTemplateResDTO)
  async renderDocxTemplateForTesting(@Body() body: RenderDocxTemplateBodyDTO) {
    return await this.assessmentService.renderDocxTemplateForTesting(body)
  }

  /**
   * POST /assessments/render-docx-template-with-images
   * Render DOCX template with image support for testing purposes
   * Images are loaded from S3 URLs provided in the data
   * Public endpoint - no authentication required
   */
  @Post('render-docx-template-with-images')
  @IsPublic()
  @ZodSerializerDto(RenderDocxTemplateResDTO)
  async renderDocxTemplateWithImagesForTesting(@Body() body: RenderDocxTemplateBodyDTO) {
    return await this.assessmentService.renderDocxTemplateWithImagesForTesting(body)
  }

  /**
   * POST /assessments/render-docx-template-with-images/download
   * Render DOCX template with image support and return as direct download
   * Images are loaded from S3 URLs provided in the data
   * Public endpoint - no authentication required
   */
  @Post('render-docx-template-with-images/download')
  @IsPublic()
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  async renderDocxTemplateWithImagesForDownload(
    @Body() body: RenderDocxTemplateBodyDTO,
    @Res() res: Response
  ) {
    const result = await this.assessmentService.renderDocxTemplateWithImagesForTesting(body)
    
    // Convert base64 back to buffer
    const buffer = Buffer.from(result.data.buffer, 'base64')
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${result.data.filename}"`)
    res.setHeader('Content-Length', buffer.length)
    
    // Send the buffer directly
    res.send(buffer)
  }
}

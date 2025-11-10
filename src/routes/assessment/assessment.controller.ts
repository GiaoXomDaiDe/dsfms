import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
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
  ConfirmAssessmentParticipationResDTO,
  GetDepartmentAssessmentsQueryDTO,
  GetDepartmentAssessmentsResDTO,
  ApproveRejectAssessmentBodyDTO,
  ApproveRejectAssessmentResDTO,
  GetAssessmentEventsQueryDTO,
  GetAssessmentEventsResDTO,
  UpdateAssessmentEventBodyDTO,
  UpdateAssessmentEventParamsDTO,
  UpdateAssessmentEventResDTO
} from './assessment.dto'
import { AssessmentService } from './assessment.service'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'

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

    return await this.assessmentService.getAssessmentSections(
      params.assessmentId,
      userContext
    )
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

    return await this.assessmentService.getAssessmentSectionFields(
      assessmentSectionId,
      userContext
    )
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

    return await this.assessmentService.toggleTraineeLock(
      params.assessmentId,
      body,
      userContext
    )
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

    return await this.assessmentService.submitAssessment(
      params.assessmentId,
      userContext
    )
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
   * Confirm trainee participation and change status from SIGNATURE_PENDING to READY_TO_SUBMIT
   */
  @Put(':assessmentId/confirm-participation')
  @ZodSerializerDto(ConfirmAssessmentParticipationResDTO)
  async confirmAssessmentParticipation(
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

    return await this.assessmentService.confirmAssessmentParticipation(
      params.assessmentId,
      userContext
    )
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

    return await this.assessmentService.approveRejectAssessment(
      params.assessmentId,
      body,
      userContext
    )
  }
}
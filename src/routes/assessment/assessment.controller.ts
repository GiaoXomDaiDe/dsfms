import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
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
  GetCourseAssessmentsResDTO
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
}
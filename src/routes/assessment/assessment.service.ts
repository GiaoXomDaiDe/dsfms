import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException
} from '@nestjs/common'
import { CourseStatus, SubjectStatus, AssessmentResult } from '@prisma/client'
import PizZip = require('pizzip')
import Docxtemplater = require('docxtemplater')
import { AssessmentRepo } from './assessment.repo'
import { NodemailerService } from '../email/nodemailer.service'
import { MediaService } from '../media/media.service'
import { PdfConverterService } from '~/shared/services/pdf-converter.service'
import { S3Service } from '~/shared/services/s3.service'
import {
  CreateAssessmentBodyType,
  CreateBulkAssessmentBodyType,
  CreateAssessmentResType,
  CreateBulkAssessmentResType,
  GetAssessmentsQueryType,
  GetAssessmentsResType,
  GetAssessmentDetailResType,
  GetSubjectAssessmentsQueryType,
  GetSubjectAssessmentsResType,
  GetCourseAssessmentsQueryType,
  GetCourseAssessmentsResType,
  GetAssessmentSectionsResType,
  GetAssessmentSectionFieldsResType,
  SaveAssessmentValuesBodyType,
  SaveAssessmentValuesResType,
  ToggleTraineeLockBodyType,
  ToggleTraineeLockResType,
  SubmitAssessmentResType,
  UpdateAssessmentValuesBodyType,
  UpdateAssessmentValuesResType,
  ConfirmAssessmentParticipationBodyType,
  ConfirmAssessmentParticipationResType,
  GetDepartmentAssessmentsQueryType,
  GetDepartmentAssessmentsResType,
  ApproveRejectAssessmentBodyType,
  ApproveRejectAssessmentResType,
  GetAssessmentEventsQueryType,
  GetAssessmentEventsResType,
  GetUserAssessmentEventsQueryType,
  GetUserAssessmentEventsResType,
  UpdateAssessmentEventBodyType,
  UpdateAssessmentEventParamsType,
  UpdateAssessmentEventResType,
  RenderDocxTemplateBodyType,
  RenderDocxTemplateResType,
  GetEventSubjectAssessmentsBodyType,
  GetEventSubjectAssessmentsQueryType,
  GetEventSubjectAssessmentsResType,
  GetEventCourseAssessmentsBodyType,
  GetEventCourseAssessmentsQueryType,
  GetEventCourseAssessmentsResType,
  ArchiveAssessmentEventBodyType,
  ArchiveAssessmentEventResType
} from './assessment.model'
import {
  TemplateNotFoundException,
  TemplateNotActiveException,
  TemplateNotPublishedException,
  TemplateDepartmentMismatchException,
  SubjectNotFoundException,
  CourseNotFoundException,
  SubjectNotActiveException,
  CourseNotActiveException,
  OccurrenceDateBeforeStartException,
  OccurrenceDateAfterEndException,
  TraineeNotFoundException,
  TraineeNotActiveException,
  TraineeNotEnrolledException,
  TraineeInvalidRoleException,
  AssessmentAlreadyExistsException,
  TemplateSectionNotFoundException,
  TemplateFieldNotFoundException,
  AssessmentFormCreationFailedException,
  DatabaseTransactionFailedException,
  AssessmentNotFoundException,
  AssessmentNotAccessibleException,
  NoEnrolledTraineesFoundException,
  AllTraineesExcludedException,
  TraineeAssessmentExistsException
} from './assessment.error'
import { isNotFoundPrismaError } from '~/shared/helper'

@Injectable()
export class AssessmentService {
  constructor(
    private readonly assessmentRepo: AssessmentRepo,
    private readonly nodemailerService: NodemailerService,
    private readonly mediaService: MediaService,
    private readonly pdfConverterService: PdfConverterService,
    private readonly s3Service: S3Service
  ) {}

  /**
   * Create assessments for specific trainees
   */
  async createAssessments(
    data: CreateAssessmentBodyType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<CreateAssessmentResType> {
    try {
      // Step 1: Validate template exists and is PUBLISHED
      const template = await this.assessmentRepo.getTemplateWithStructure(data.templateId)
      if (!template) {
        throw TemplateNotPublishedException
      }

      // Step 2: Validate subject or course
      let subject = null
      let course = null
      let entityDepartmentId = ''
      let startDate: Date
      let endDate: Date

      if (data.subjectId) {
        subject = await this.assessmentRepo.getSubjectWithDetails(data.subjectId)
        if (!subject) {
          throw SubjectNotFoundException
        }
        if (subject.status !== SubjectStatus.PLANNED && subject.status !== SubjectStatus.ON_GOING) {
          throw SubjectNotActiveException
        }
        entityDepartmentId = subject.course.department.id
        startDate = new Date(subject.startDate)
        endDate = new Date(subject.endDate)
      } else if (data.courseId) {
        course = await this.assessmentRepo.getCourseWithDetails(data.courseId)
        if (!course) {
          throw CourseNotFoundException
        }
        if (course.status !== CourseStatus.PLANNED && course.status !== CourseStatus.ON_GOING) {
          throw CourseNotActiveException
        }
        entityDepartmentId = course.department.id
        startDate = new Date(course.startDate)
        endDate = new Date(course.endDate)
      } else {
        // This should not happen due to Zod validation, but keeping for safety
        throw new BadRequestException('Either subjectId or courseId must be provided')
      }

      // Step 2.1: Validate template fields compatibility with subject/course scoring requirements
      const entity = subject || course
      const entityType = data.subjectId ? 'Subject' : 'Course'
      const entityPassScore = entity!.passScore

      // Check if template has FINAL_SCORE_NUM field
      const hasFinalScoreNumField = template.sections.some((section) =>
        section.fields.some((field) => field.fieldType === 'FINAL_SCORE_NUM')
      )

      if (entityPassScore === null || entityPassScore === undefined) {
        // Entity doesn't use score - template should not require score
        if (hasFinalScoreNumField) {
          throw new BadRequestException(
            `The current Template need Final Score to assess Trainee, but this ${entityType} does not use score to assess Trainee! Please report this if this is false error`
          )
        }
      } else {
        // Entity uses score - template must have score field
        if (!hasFinalScoreNumField) {
          throw new BadRequestException(
            `This ${entityType} requires final score to assess Trainee, but the current Template does not have field to assess score! Please report this if this is false error`
          )
        }
      }

      // Step 3: Validate department consistency
      if (template.departmentId !== entityDepartmentId) {
        throw TemplateDepartmentMismatchException
      }

      // Step 4: Validate occurrence date is not in the past and is after start date
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const occurrenceDate = new Date(data.occuranceDate)
      occurrenceDate.setHours(0, 0, 0, 0)

      if (occurrenceDate < today) {
        throw new BadRequestException('Cannot create assessment with occurrence date in the past')
      }

      if (occurrenceDate < startDate) {
        throw OccurrenceDateBeforeStartException(startDate, data.subjectId ? 'subject' : 'course')
      }

      // Step 5: Validate trainees
      const validTrainees = await this.assessmentRepo.validateTrainees(data.traineeIds, data.subjectId, data.courseId)

      // Check if all requested trainees were found and valid
      const foundTraineeIds = validTrainees.map((t) => t.id)
      const missingTraineeIds = data.traineeIds.filter((id) => !foundTraineeIds.includes(id))

      if (missingTraineeIds.length > 0) {
        // Get more details about missing trainees
        const allRequestedTrainees = await this.getAllTraineeDetails(data.traineeIds)
        const missingTrainees = allRequestedTrainees.filter((t) => missingTraineeIds.includes(t.id))

        const notFoundTrainees = missingTrainees.filter((t) => !t.exists)
        const invalidRoleTrainees = missingTrainees.filter((t) => t.exists && t.role !== 'TRAINEE')
        const inactiveTrainees = missingTrainees.filter((t) => t.exists && t.role === 'TRAINEE' && !t.isActive)
        const notEnrolledTrainees = missingTrainees.filter(
          (t) => t.exists && t.role === 'TRAINEE' && t.isActive && !t.isEnrolled
        )

        if (notFoundTrainees.length > 0) {
          throw TraineeNotFoundException(notFoundTrainees.map((t) => t.id))
        }
        if (invalidRoleTrainees.length > 0) {
          throw TraineeInvalidRoleException(invalidRoleTrainees.map((t) => t.id))
        }
        if (inactiveTrainees.length > 0) {
          throw TraineeNotActiveException(inactiveTrainees.map((t) => t.id))
        }
        if (notEnrolledTrainees.length > 0) {
          throw TraineeNotEnrolledException(
            notEnrolledTrainees.map((t) => t.id),
            data.subjectId ? 'subject' : 'course'
          )
        }
      }

      // Step 7: Check if any assessment form already exists for trainees with same template and occurrence date
      const existingAssessments = await this.assessmentRepo.checkTraineeAssessmentExists(
        data.traineeIds,
        data.templateId,
        data.occuranceDate
      )

      if (existingAssessments.length > 0) {
        throw TraineeAssessmentExistsException(existingAssessments, data.subjectId ? 'subject' : 'course')
      }

      // Step 8: Validate template structure
      if (!template?.sections || template.sections.length === 0) {
        throw TemplateSectionNotFoundException
      }

      const templateSections = template.sections.map((section: any) => ({
        id: section.id,
        fields: section.fields.map((field: any) => ({ id: field.id }))
      }))

      // Validate that all sections have fields
      const sectionsWithoutFields = templateSections.filter((section: any) => section.fields.length === 0)
      if (sectionsWithoutFields.length > 0) {
        throw TemplateFieldNotFoundException
      }

      // Step 9: Create assessments in database transaction
      const createdAssessments = await this.assessmentRepo.createAssessments(data, templateSections, currentUser.userId)

      if (!createdAssessments || createdAssessments.length === 0) {
        throw AssessmentFormCreationFailedException
      }

      return {
        success: true,
        message: `Successfully created ${createdAssessments.length} assessment(s)`,
        assessments: createdAssessments,
        totalCreated: createdAssessments.length
      }
    } catch (error) {
      // Log the error for debugging
      console.error('Assessment creation failed:', error)

      // Re-throw known business logic errors
      if (
        error.name === 'BadRequestException' ||
        error.name === 'NotFoundException' ||
        error.name === 'ForbiddenException' ||
        error.name === 'ConflictException' ||
        error.name === 'UnprocessableEntityException'
      ) {
        throw error
      }

      // Handle Prisma transaction errors
      if (error.code === 'P2034' || error.message?.includes('transaction')) {
        throw DatabaseTransactionFailedException
      }

      // Handle other unexpected errors
      throw AssessmentFormCreationFailedException
    }
  }

  /**
   * Create assessments for ALL enrolled trainees in a course/subject
   */
  async createBulkAssessments(
    data: CreateBulkAssessmentBodyType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<CreateBulkAssessmentResType> {
    try {
      // Step 1: Validate template exists and is PUBLISHED
      const template = await this.assessmentRepo.getTemplateWithStructure(data.templateId)
      if (!template) {
        throw TemplateNotPublishedException
      }

      // Step 2: Validate subject or course and get enrolled trainees
      let subject = null
      let course = null
      let entityDepartmentId = ''
      let startDate: Date
      let endDate: Date
      let enrolledTrainees: Array<{
        id: string
        eid: string
        firstName: string
        lastName: string
        middleName: string | null
        email: string
        enrollmentStatus: string
      }> = []
      let entityInfo: { id: string; name: string; code: string; type: 'subject' | 'course' }

      if (data.subjectId) {
        subject = await this.assessmentRepo.getSubjectWithDetails(data.subjectId)
        if (!subject) {
          throw SubjectNotFoundException
        }
        if (subject.status !== SubjectStatus.PLANNED && subject.status !== SubjectStatus.ON_GOING) {
          throw SubjectNotActiveException
        }
        entityDepartmentId = subject.course.department.id
        startDate = new Date(subject.startDate)
        endDate = new Date(subject.endDate)
        enrolledTrainees = await this.assessmentRepo.getEnrolledTraineesForSubject(data.subjectId)
        entityInfo = {
          id: subject.id,
          name: subject.name,
          code: subject.code,
          type: 'subject'
        }
      } else if (data.courseId) {
        course = await this.assessmentRepo.getCourseWithDetails(data.courseId)
        if (!course) {
          throw CourseNotFoundException
        }
        if (course.status !== CourseStatus.PLANNED && course.status !== CourseStatus.ON_GOING) {
          throw CourseNotActiveException
        }
        entityDepartmentId = course.department.id
        startDate = new Date(course.startDate)
        endDate = new Date(course.endDate)
        enrolledTrainees = await this.assessmentRepo.getEnrolledTraineesForCourse(data.courseId)
        entityInfo = {
          id: course.id,
          name: course.name,
          code: course.code,
          type: 'course'
        }
      } else {
        // This should not happen due to Zod validation, but keeping for safety
        throw new BadRequestException('Either subjectId or courseId must be provided')
      }

      // Step 2.1: Validate template fields compatibility with subject/course scoring requirements
      const entity = subject || course
      const entityType = data.subjectId ? 'Subject' : 'Course'
      const entityPassScore = entity!.passScore

      // Check if template has FINAL_SCORE_NUM field
      const hasFinalScoreNumField = template.sections.some((section) =>
        section.fields.some((field) => field.fieldType === 'FINAL_SCORE_NUM')
      )

      if (entityPassScore === null || entityPassScore === undefined) {
        // Entity doesn't use score - template should not require score
        if (hasFinalScoreNumField) {
          throw new BadRequestException(
            `The current Template need Final Score to assess Trainee, but this ${entityType} does not use score to assess Trainee! Please report this if this is false error`
          )
        }
      } else {
        // Entity uses score - template must have score field
        if (!hasFinalScoreNumField) {
          throw new BadRequestException(
            `This ${entityType} requires final score to assess Trainee, but the current Template does not have field to assess score! Please report this if this is false error`
          )
        }
      }

      // Step 3: Check if any trainees are enrolled
      // For course-level assessments: trainees enrolled in at least one active subject in the course
      if (enrolledTrainees.length === 0) {
        throw NoEnrolledTraineesFoundException(data.subjectId ? 'subject' : 'course', entityInfo.name)
      }

      // Step 4: Filter out excluded trainees if specified
      const excludeIds = data.excludeTraineeIds || []
      const eligibleTrainees = enrolledTrainees.filter((trainee) => !excludeIds.includes(trainee.id))

      if (eligibleTrainees.length === 0) {
        throw AllTraineesExcludedException(enrolledTrainees.length)
      }

      // Step 5: Validate template department consistency
      if (template.departmentId !== entityDepartmentId) {
        throw TemplateDepartmentMismatchException
      }

      // Step 6: Validate occurrence date is not in the past and is after start date
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const occurrenceDate = new Date(data.occuranceDate)
      occurrenceDate.setHours(0, 0, 0, 0)

      if (occurrenceDate < today) {
        throw new BadRequestException('Cannot create assessment with occurrence date in the past')
      }

      if (occurrenceDate < startDate) {
        throw OccurrenceDateBeforeStartException(startDate, data.subjectId ? 'subject' : 'course')
      }

      // Step 7: Check for existing assessments and filter out trainees who already have assessments
      const traineeIds = eligibleTrainees.map((t) => t.id)
      const existingAssessments = await this.assessmentRepo.checkTraineeAssessmentExists(
        traineeIds,
        data.templateId,
        data.occuranceDate
      )

      // Filter out trainees who already have assessments
      const existingTraineeIds = existingAssessments.map((d) => d.traineeId)
      const finalTraineeIds = traineeIds.filter((id) => !existingTraineeIds.includes(id))
      const finalTrainees = eligibleTrainees.filter((t) => finalTraineeIds.includes(t.id))

      // Track skipped trainees for response
      const skippedTrainees = [
        // Excluded trainees
        ...enrolledTrainees
          .filter((t) => excludeIds.includes(t.id))
          .map((t) => ({
            traineeId: t.id,
            traineeName: `${t.firstName} ${t.lastName}`.trim(),
            reason: 'Manually excluded from assessment creation'
          })),
        // Existing assessments
        ...existingAssessments.map((d) => ({
          traineeId: d.traineeId,
          traineeName: d.traineeName,
          reason: `Assessment form already exists for this ${data.subjectId ? 'subject' : 'course'}`
        }))
      ]

      if (finalTrainees.length === 0) {
        return {
          success: true,
          message: 'No assessments created - all eligible trainees already have assessments or were excluded',
          assessments: [],
          totalCreated: 0,
          totalEnrolled: enrolledTrainees.length,
          skippedTrainees,
          entityInfo
        }
      }

      // Step 9: Validate template structure
      if (!template?.sections || template.sections.length === 0) {
        throw TemplateSectionNotFoundException
      }

      const templateSections = template.sections.map((section: any) => ({
        id: section.id,
        fields: section.fields.map((field: any) => ({ id: field.id }))
      }))

      // Step 10: Create assessments in database transaction
      const bulkData: CreateAssessmentBodyType = {
        templateId: data.templateId,
        subjectId: data.subjectId,
        courseId: data.courseId,
        occuranceDate: data.occuranceDate,
        name: data.name,
        traineeIds: finalTraineeIds
      }

      // console.log('Service: About to call createAssessments with bulkData:', bulkData)
      const createdAssessments = await this.assessmentRepo.createAssessments(
        bulkData,
        templateSections,
        currentUser.userId
      )
      // console.log('Service: Created assessments count:', createdAssessments?.length)

      if (!createdAssessments || createdAssessments.length === 0) {
        throw AssessmentFormCreationFailedException
      }

      return {
        success: true,
        message: `Successfully created ${createdAssessments.length} assessment(s) for ${entityInfo.type}: ${entityInfo.name}`,
        assessments: createdAssessments,
        totalCreated: createdAssessments.length,
        totalEnrolled: enrolledTrainees.length,
        skippedTrainees,
        entityInfo
      }
    } catch (error) {
      // Log the error for debugging
      console.error('Bulk assessment creation failed:', error)

      // Re-throw known business logic errors
      if (
        error.name === 'BadRequestException' ||
        error.name === 'NotFoundException' ||
        error.name === 'ForbiddenException' ||
        error.name === 'ConflictException' ||
        error.name === 'UnprocessableEntityException'
      ) {
        throw error
      }

      // Handle Prisma transaction errors
      if (error.code === 'P2034' || error.message?.includes('transaction')) {
        throw DatabaseTransactionFailedException
      }

      // Handle other unexpected errors
      throw AssessmentFormCreationFailedException
    }
  }

  /**
   * Get list of assessments with pagination and filters
   */
  async list(
    query: GetAssessmentsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetAssessmentsResType> {
    // Filter assessments based on user role and permissions
    const filteredQuery = this.applyUserFilters(query, currentUser)

    return await this.assessmentRepo.list(filteredQuery)
  }

  /**
   * Get assessment by ID with full details
   */
  async findById(
    assessmentId: string,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetAssessmentDetailResType> {
    // Check if assessment exists
    const assessment = await this.assessmentRepo.findById(assessmentId)
    if (!assessment) {
      throw AssessmentNotFoundException
    }

    // Check if user has permission to access this assessment
    const hasAccess = await this.assessmentRepo.checkAssessmentAccess(
      assessmentId,
      currentUser.userId,
      currentUser.roleName
    )

    if (!hasAccess) {
      throw AssessmentNotAccessibleException
    }

    return assessment
  }

  /**
   * Get assessments for a specific subject (for trainers and trainees)
   */
  async getSubjectAssessments(
    query: GetSubjectAssessmentsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetSubjectAssessmentsResType> {
    try {
      const result = await this.assessmentRepo.getSubjectAssessments(
        query.subjectId,
        currentUser.userId,
        currentUser.roleName,
        query.page,
        query.limit,
        query.status,
        query.search
      )

      return result
    } catch (error) {
      console.error('Get subject assessments failed:', error)

      if (error.message === 'Trainer is not assigned to this subject') {
        throw new ForbiddenException('You are not assigned to this subject')
      }

      if (error.message === 'Subject not found') {
        throw SubjectNotFoundException
      }

      if (error.message === 'Access denied') {
        throw new ForbiddenException('You do not have permission to access assessments in this subject')
      }

      throw new InternalServerErrorException('Failed to get subject assessments')
    }
  }

  /**
   * Get assessments for a specific course (for trainers and trainees)
   */
  async getCourseAssessments(
    query: GetCourseAssessmentsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetCourseAssessmentsResType> {
    try {
      const result = await this.assessmentRepo.getCourseAssessments(
        query.courseId,
        currentUser.userId,
        currentUser.roleName,
        query.page,
        query.limit,
        query.status,
        query.search
      )

      return result
    } catch (error) {
      console.error('Get course assessments failed:', error)

      if (error.message === 'Trainer is not assigned to this course') {
        throw new ForbiddenException('You are not assigned to this course')
      }

      if (error.message === 'Course not found') {
        throw CourseNotFoundException
      }

      if (error.message === 'Access denied') {
        throw new ForbiddenException('You do not have permission to access assessments in this course')
      }

      throw new InternalServerErrorException('Failed to get course assessments')
    }
  }

  /**
   * Get assessments for a department (for Department Head)
   */
  async getDepartmentAssessments(
    query: GetDepartmentAssessmentsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetDepartmentAssessmentsResType> {
    try {
      // Get user's department from database
      const user = await this.assessmentRepo.prismaClient.user.findUnique({
        where: { id: currentUser.userId },
        select: { departmentId: true }
      })
      // console.log ('Current User ID:', currentUser.userId)
      // console.log ('User department ID:', user?.departmentId)
      if (!user?.departmentId) {
        throw new ForbiddenException('Department Head must have a department assigned')
      }

      const result = await this.assessmentRepo.getDepartmentAssessments(
        user.departmentId,
        query.page,
        query.limit,
        query.status,
        query.templateId,
        query.subjectId,
        query.courseId,
        query.traineeId,
        query.fromDate,
        query.toDate,
        query.search
      )

      return result
    } catch (error) {
      console.error('Get department assessments failed:', error)

      if (error instanceof ForbiddenException) {
        throw error
      }

      throw new BadRequestException('Failed to get department assessments')
    }
  }

  /**
   * Apply user-specific filters to assessment queries
   */
  private applyUserFilters(
    query: GetAssessmentsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): GetAssessmentsQueryType {
    const { roleName, userId, departmentId } = currentUser

    // ADMINISTRATOR can see all assessments
    if (roleName === 'ADMINISTRATOR') {
      return query
    }

    // ACADEMIC_DEPARTMENT can see all assessments (they create and manage assessments)
    if (roleName === 'ACADEMIC_DEPARTMENT') {
      return query
    }

    // TRAINEE can only see their own assessments
    if (roleName === 'TRAINEE') {
      return {
        ...query,
        traineeId: userId,
        includeDeleted: false // Trainees should never see deleted assessments
      }
    }

    // DEPARTMENT_HEAD and TRAINER see assessments in their department
    if (roleName === 'DEPARTMENT_HEAD' || roleName === 'TRAINER') {
      // This would require a more complex filter in the repository
      // For now, returning the query as-is and relying on repository-level filtering
      return {
        ...query,
        includeDeleted: false
      }
    }

    // Default: very restrictive for unknown roles
    return {
      ...query,
      traineeId: userId,
      includeDeleted: false
    }
  }

  /**
   * Get details about all requested trainees for error reporting
   */
  private async getAllTraineeDetails(traineeIds: string[]) {
    const trainees = await this.assessmentRepo.prismaClient.user.findMany({
      where: {
        id: { in: traineeIds }
      },
      select: {
        id: true,
        status: true,
        role: {
          select: {
            name: true
          }
        },
        subjectEnrollments: {
          select: {
            status: true
          }
        }
      }
    })

    return traineeIds.map((id) => {
      const trainee = trainees.find((t) => t.id === id)
      return {
        id,
        exists: !!trainee,
        role: trainee?.role.name || null,
        isActive: trainee?.status === 'ACTIVE',
        isEnrolled: trainee?.subjectEnrollments.some((e) => e.status === 'ENROLLED') || false
      }
    })
  }

  /**
   * Get assessment sections that a user can assess
   */
  async getAssessmentSections(
    assessmentId: string,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ) {
    try {
      // First check if assessment exists and user has access to it
      const hasAccess = await this.assessmentRepo.checkAssessmentAccess(
        assessmentId,
        currentUser.userId,
        currentUser.roleName
      )

      if (!hasAccess) {
        throw AssessmentNotAccessibleException
      }

      // Get sections with permission information
      const result = await this.assessmentRepo.getAssessmentSections(assessmentId, currentUser.userId)

      return result
    } catch (error) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle custom application errors
      if (error.name === 'ForbiddenException') {
        throw new ForbiddenException(error.message)
      }

      if (error.message === 'Assessment not found') {
        throw AssessmentNotFoundException
      }

      // Handle any other unexpected errors
      console.error('Get assessment sections failed:', error)
      throw new NotFoundException('Failed to get assessment sections')
    }
  }

  /**
   * Get TRAINEE sections of an assessment form
   * Allows users with course/subject access to view trainee sections
   */
  async getTraineeSections(
    assessmentId: string,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ) {
    try {
      // Get trainee sections (access check is done in repository)
      const result = await this.assessmentRepo.getTraineeSections(assessmentId, currentUser.userId)

      return result
    } catch (error) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle custom application errors
      if (error.message === 'Assessment not found') {
        throw AssessmentNotFoundException
      }

      if (error.message === 'You do not have permission to access this assessment') {
        throw new ForbiddenException('You do not have permission to access this assessment')
      }

      // Handle any other unexpected errors
      console.error('Get trainee sections failed:', error)
      throw new NotFoundException('Failed to get trainee sections')
    }
  }

  /**
   * Get all fields of an assessment section with their template field information and assessment values
   */
  async getAssessmentSectionFields(
    assessmentSectionId: string,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ) {
    try {
      // Get the assessment section fields with basic info
      const result = await this.assessmentRepo.getAssessmentSectionFields(assessmentSectionId, currentUser.userId)

      // Get the assessment form ID to check permissions
      const assessmentFormId = result.assessmentSectionInfo.assessmentFormId

      // First check if user has access to the assessment form
      const hasAccess = await this.assessmentRepo.checkAssessmentAccess(
        assessmentFormId,
        currentUser.userId,
        currentUser.roleName
      )

      if (!hasAccess) {
        throw AssessmentNotAccessibleException
      }

      // Now check if user has permission to access this specific section based on role
      const templateSection = result.assessmentSectionInfo.templateSection

      // Get user's role in the assessment (same logic as getAssessmentSections)
      let userRoleInAssessment: string | null = null

      // Get assessment details to check subject/course
      const assessment = await this.assessmentRepo.findById(assessmentFormId)

      if (assessment?.subjectId) {
        // Check if user is instructor for this subject
        const subjectInstructor = await this.assessmentRepo.prismaClient.subjectInstructor.findFirst({
          where: {
            subjectId: assessment.subjectId,
            trainerUserId: currentUser.userId
          },
          select: {
            roleInAssessment: true
          }
        })
        userRoleInAssessment = subjectInstructor?.roleInAssessment || null
      } else if (assessment?.courseId) {
        // Check if user is instructor for this course
        const courseInstructor = await this.assessmentRepo.prismaClient.courseInstructor.findFirst({
          where: {
            courseId: assessment.courseId,
            trainerUserId: currentUser.userId
          },
          select: {
            roleInAssessment: true
          }
        })
        userRoleInAssessment = courseInstructor?.roleInAssessment || null
      }

      // Check section-level permissions
      let canAccess = false

      if (templateSection.editBy === 'TRAINER') {
        // Section requires trainer access
        if (currentUser.roleName === 'TRAINER') {
          // Check if section requires specific role in subject/course
          if (templateSection.roleInSubject) {
            // Section requires specific assessment role
            canAccess = userRoleInAssessment === templateSection.roleInSubject
          } else {
            // Section just requires trainer role
            canAccess = userRoleInAssessment !== null // Must be assigned to subject/course
          }
        } else if (currentUser.roleName === 'DEPARTMENT_HEAD' || currentUser.roleName === 'DEPARTMENT HEAD') {
          // DEPARTMENT_HEAD can view all sections (already passed checkAssessmentAccess)
          canAccess = true
        }
      } else if (templateSection.editBy === 'TRAINEE') {
        // Section requires trainee access - trainee can access their own assessment
        // OR trainers with assessment permission can view trainee sections
        if (currentUser.roleName === 'TRAINEE') {
          canAccess = assessment?.traineeId === currentUser.userId
        } else if (currentUser.roleName === 'TRAINER') {
          // Trainers who can assess this assessment form can view trainee sections
          canAccess = userRoleInAssessment !== null // Must be assigned to subject/course
        } else if (currentUser.roleName === 'DEPARTMENT_HEAD' || currentUser.roleName === 'DEPARTMENT HEAD') {
          // DEPARTMENT_HEAD can view all sections (already passed checkAssessmentAccess)
          canAccess = true
        }
      }

      if (!canAccess) {
        throw new ForbiddenException('You do not have permission to access this assessment section')
      }

      return result
    } catch (error) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle custom application errors
      if (error.name === 'ForbiddenException') {
        throw new ForbiddenException(error.message)
      }

      if (error.message === 'Assessment section not found') {
        throw new NotFoundException('Assessment section not found')
      }

      // Handle any other unexpected errors
      console.error('Get assessment section fields failed:', error)
      throw new NotFoundException('Failed to get assessment section fields')
    }
  }

  /**
   * Save assessment values for a section
   */
  async saveAssessmentValues(
    body: SaveAssessmentValuesBodyType,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ): Promise<SaveAssessmentValuesResType> {
    try {
      // First, get the assessment section to check permissions
      const sectionFields = await this.assessmentRepo.getAssessmentSectionFields(
        body.assessmentSectionId,
        userContext.userId
      )

      // Get assessment info for permission check
      const assessmentSection = await this.assessmentRepo.prismaClient.assessmentSection.findUnique({
        where: { id: body.assessmentSectionId },
        include: {
          assessmentForm: {
            select: {
              id: true,
              traineeId: true,
              subjectId: true,
              courseId: true
            }
          },
          templateSection: {
            select: {
              editBy: true,
              roleInSubject: true
            }
          }
        }
      })

      if (!assessmentSection) {
        throw new NotFoundException('Assessment section not found')
      }

      // Check permission to edit this section
      const hasPermission = await this.checkSectionEditPermission(
        assessmentSection.assessmentForm.id,
        assessmentSection.templateSection.editBy,
        assessmentSection.templateSection.roleInSubject,
        userContext
      )

      if (!hasPermission) {
        throw new ForbiddenException('You do not have permission to edit this assessment section')
      }

      // Validate that all provided assessment value IDs belong to this section
      const sectionValueIds = sectionFields.fields.map((field) => field.assessmentValue.id)
      const providedValueIds = body.values.map((v) => v.assessmentValueId)

      const invalidIds = providedValueIds.filter((id) => !sectionValueIds.includes(id))
      if (invalidIds.length > 0) {
        throw new BadRequestException(`Invalid assessment value IDs: ${invalidIds.join(', ')}`)
      }

      // Validate SIGNATURE_DRAW fields - they cannot be null or empty
      for (const value of body.values) {
        const field = sectionFields.fields.find((f) => f.assessmentValue.id === value.assessmentValueId)
        if (field?.templateField.fieldType === 'SIGNATURE_DRAW') {
          if (!value.answerValue || value.answerValue.trim() === '') {
            throw new BadRequestException(`Trường "${field.templateField.label}" cần phải được điền trước khi save`)
          }
        }
      }

      // Check for concurrent access - ensure section is still unassessed
      const currentSection = await this.assessmentRepo.prismaClient.assessmentSection.findUnique({
        where: { id: body.assessmentSectionId },
        select: { assessedById: true, createdAt: true }
      })

      if (!currentSection) {
        throw new NotFoundException('Assessment section not found')
      }

      if (currentSection.assessedById !== null) {
        throw new BadRequestException(
          'This section has already been assessed by another user. Please refresh and check the current status.'
        )
      }

      // Save the values
      return await this.assessmentRepo.saveAssessmentValues(body.assessmentSectionId, body.values, userContext.userId)
    } catch (error: any) {
      // Handle specific known errors
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle any other unexpected errors
      console.error('Save assessment values failed:', error)
      throw new BadRequestException('Failed to save assessment values')
    }
  }

  /**
   * Toggle trainee lock status
   */
  async toggleTraineeLock(
    assessmentId: string,
    body: ToggleTraineeLockBodyType,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ): Promise<ToggleTraineeLockResType> {
    try {
      // Check if user has access to this assessment
      const hasAccess = await this.assessmentRepo.checkAssessmentAccess(
        assessmentId,
        userContext.userId,
        userContext.roleName
      )

      if (!hasAccess) {
        throw new ForbiddenException('You do not have permission to access this assessment')
      }

      return await this.assessmentRepo.toggleTraineeLock(assessmentId, body.isTraineeLocked, userContext.userId)
    } catch (error: any) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle custom application errors from repository
      if (
        error.message.includes('occurrence date') ||
        error.message.includes('trainee sections') ||
        error.message.includes('assessed at least one section')
      ) {
        throw new BadRequestException(error.message)
      }

      // Handle any other unexpected errors
      console.error('Toggle trainee lock failed:', error)
      throw new BadRequestException('Failed to toggle trainee lock')
    }
  }

  /**
   * Submit assessment
   */
  async submitAssessment(
    assessmentId: string,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ): Promise<SubmitAssessmentResType> {
    try {
      // Check if user has access to this assessment
      const hasAccess = await this.assessmentRepo.checkAssessmentAccess(
        assessmentId,
        userContext.userId,
        userContext.roleName
      )

      if (!hasAccess) {
        throw new ForbiddenException('You do not have permission to access this assessment')
      }

      return await this.assessmentRepo.submitAssessment(assessmentId, userContext.userId)
    } catch (error: any) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle custom application errors from repository
      if (
        error.message.includes('not ready to submit') ||
        error.message.includes('must be completed') ||
        error.message.includes('submittable section')
      ) {
        throw new BadRequestException(error.message)
      }

      // Handle any other unexpected errors
      console.error('Submit assessment failed:', error)
      throw new BadRequestException('Failed to submit assessment')
    }
  }

  /**
   * Helper method to check section edit permissions
   */
  private async checkSectionEditPermission(
    assessmentId: string,
    sectionEditBy: string,
    sectionRoleInSubject: string | null,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ): Promise<boolean> {
    // Get assessment details
    const assessment = await this.assessmentRepo.prismaClient.assessmentForm.findUnique({
      where: { id: assessmentId },
      select: {
        traineeId: true,
        subjectId: true,
        courseId: true
      }
    })

    if (!assessment) {
      return false
    }

    // If section is for trainee
    if (sectionEditBy === 'TRAINEE') {
      return userContext.roleName === 'TRAINEE' && assessment.traineeId === userContext.userId
    }

    // If section is for trainer
    if (sectionEditBy === 'TRAINER' && userContext.roleName === 'TRAINER') {
      // Check role in subject/course if required
      if (sectionRoleInSubject) {
        // Get user's role in assessment
        let userRoleInAssessment: string | null = null

        if (assessment.subjectId) {
          const subjectInstructor = await this.assessmentRepo.prismaClient.subjectInstructor.findFirst({
            where: {
              subjectId: assessment.subjectId,
              trainerUserId: userContext.userId
            },
            select: {
              roleInAssessment: true
            }
          })
          userRoleInAssessment = subjectInstructor?.roleInAssessment || null
        } else if (assessment.courseId) {
          const courseInstructor = await this.assessmentRepo.prismaClient.courseInstructor.findFirst({
            where: {
              courseId: assessment.courseId,
              trainerUserId: userContext.userId
            },
            select: {
              roleInAssessment: true
            }
          })
          userRoleInAssessment = courseInstructor?.roleInAssessment || null
        }

        return userRoleInAssessment === sectionRoleInSubject
      } else {
        // Just need to be assigned to the subject/course
        return assessment.subjectId !== null || assessment.courseId !== null
      }
    }

    return false
  }

  /**
   * Update assessment values (only by original assessor)
   */
  async updateAssessmentValues(
    body: UpdateAssessmentValuesBodyType,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ): Promise<UpdateAssessmentValuesResType> {
    try {
      // First, get the assessment section to validate access
      const sectionFields = await this.assessmentRepo.getAssessmentSectionFields(
        body.assessmentSectionId,
        userContext.userId
      )

      // Validate that all provided assessment value IDs belong to this section
      const sectionValueIds = sectionFields.fields.map((field) => field.assessmentValue.id)
      const providedValueIds = body.values.map((v: any) => v.assessmentValueId)

      const invalidIds = providedValueIds.filter((id: any) => !sectionValueIds.includes(id))
      if (invalidIds.length > 0) {
        throw new BadRequestException(`Invalid assessment value IDs: ${invalidIds.join(', ')}`)
      }

      // Validate SIGNATURE_DRAW fields - they cannot be null or empty
      for (const value of body.values) {
        const field = sectionFields.fields.find((f) => f.assessmentValue.id === value.assessmentValueId)
        if (field?.templateField.fieldType === 'SIGNATURE_DRAW') {
          if (!value.answerValue || value.answerValue.trim() === '') {
            throw new BadRequestException(`Trường "${field.templateField.label}" cần phải được điền trước khi update`)
          }
        }
      }

      // Check for concurrent access - ensure section is still editable by current user
      const currentSection = await this.assessmentRepo.prismaClient.assessmentSection.findUnique({
        where: { id: body.assessmentSectionId },
        select: {
          assessedById: true,
          createdAt: true,
          status: true
        }
      })

      if (!currentSection) {
        throw new NotFoundException('Assessment section not found')
      }

      if (currentSection.assessedById !== userContext.userId) {
        throw new ForbiddenException('You can only update sections that you originally assessed')
      }

      // Update the values (repository will check if user is the original assessor)
      return await this.assessmentRepo.updateAssessmentValues(body.assessmentSectionId, body.values, userContext.userId)
    } catch (error: any) {
      // Handle specific known errors
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle custom application errors from repository
      if (
        error.message.includes('originally assessed') ||
        error.message.includes('DRAFT status') ||
        error.message.includes('Cannot update values for assessment in this status')
      ) {
        throw new ForbiddenException(error.message)
      }

      if (error.message === 'Assessment section not found') {
        throw new NotFoundException('Assessment section not found')
      }

      // Handle any other unexpected errors
      console.error('Update assessment values failed:', error)
      throw new BadRequestException('Failed to update assessment values')
    }
  }

  /**
   * Confirm assessment participation - Save trainee signature and change status from SIGNATURE_PENDING to READY_TO_SUBMIT
   * Only the trainee assigned to this assessment can confirm participation
   */
  async confirmAssessmentParticipation(
    assessmentId: string,
    body: ConfirmAssessmentParticipationBodyType,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ): Promise<ConfirmAssessmentParticipationResType> {
    try {
      // Verify user role - only TRAINEE can confirm participation
      if (userContext.roleName !== 'TRAINEE') {
        throw new ForbiddenException('Only trainees can confirm assessment participation')
      }

      // Get assessment form with current status
      const assessmentForm = await this.assessmentRepo.findById(assessmentId)
      if (!assessmentForm) {
        throw new NotFoundException('Assessment not found')
      }

      // Check if the current user is the trainee assigned to this assessment
      if (assessmentForm.traineeId !== userContext.userId) {
        throw new ForbiddenException('You can only confirm participation in your own assessments')
      }

      // Check if assessment is in SIGNATURE_PENDING status
      if (assessmentForm.status !== 'SIGNATURE_PENDING') {
        throw new BadRequestException('Assessment must be in SIGNATURE_PENDING status to confirm participation')
      }

      // Update status and save trainee signature
      const result = await this.assessmentRepo.confirmAssessmentParticipation(
        assessmentId,
        body.traineeSignatureUrl,
        userContext.userId
      )

      return {
        success: true,
        message: 'Assessment participation confirmed and signature saved successfully',
        assessmentFormId: assessmentId,
        traineeId: userContext.userId,
        confirmedAt: result.updatedAt,
        status: result.status,
        previousStatus: 'SIGNATURE_PENDING',
        signatureSaved: result.signatureSaved
      }
    } catch (error: any) {
      // Handle specific known errors
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle any other unexpected errors
      console.error('Confirm assessment participation failed:', error)
      throw new BadRequestException('Failed to confirm assessment participation')
    }
  }

  /**
   * Approve or reject a SUBMITTED assessment form
   * Only authorized users (e.g., Department Head, Admin) can approve/reject assessments
   */
  async approveRejectAssessment(
    assessmentId: string,
    body: ApproveRejectAssessmentBodyType,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ): Promise<ApproveRejectAssessmentResType> {
    try {
      // Validate assessment exists and get current status
      const assessmentForm = await this.assessmentRepo.findById(assessmentId)

      if (!assessmentForm) {
        throw new NotFoundException('Assessment form not found')
      }

      // Check if user has access to this assessment (same department)
      // Get user's department from database
      const user = await this.assessmentRepo.prismaClient.user.findUnique({
        where: { id: userContext.userId },
        select: { departmentId: true }
      })

      if (user?.departmentId) {
        const hasAccess = await this.assessmentRepo.checkUserAssessmentAccess(
          assessmentId,
          userContext.userId,
          user.departmentId
        )
        if (!hasAccess) {
          throw new ForbiddenException('You do not have access to this assessment')
        }
      }

      // Check if assessment is in SUBMITTED status
      if (assessmentForm.status !== 'SUBMITTED') {
        throw new BadRequestException('Assessment must be in SUBMITTED status to approve or reject')
      }

      // // Check if user has permission to approve/reject assessments
      // // This could be expanded based on role permissions
      // if (userContext.roleName !== 'DEPARTMENT_HEAD' && userContext.roleName !== 'ADMIN') {
      //   throw new ForbiddenException('You do not have permission to approve or reject assessments')
      // }

      // Process the approval/rejection
      const result = await this.assessmentRepo.approveRejectAssessment(
        assessmentId,
        body.action,
        body.comment,
        userContext.userId
      )

      // Send email notification if assessment is rejected
      if (body.action === 'REJECTED') {
        // Log that rejection comment is being saved to assessment form
        console.log(
          `Assessment ${assessmentId} rejected with comment: "${body.comment || 'No comment provided'}" - Comment saved to assessment form`
        )

        try {
          // Get detailed assessment information for email
          const detailedAssessment = await this.assessmentRepo.getAssessmentWithDetails(assessmentId)

          // Get all trainers who assessed sections in this assessment
          const trainerAssessors = await this.assessmentRepo.getTrainerAssessors(assessmentId)

          if (detailedAssessment && trainerAssessors.length > 0) {
            // Format dates for email
            const submissionDate = detailedAssessment.submittedAt
              ? new Date(detailedAssessment.submittedAt).toLocaleDateString()
              : 'N/A'
            const reviewDate = new Date().toLocaleDateString()

            // Get reviewer name (current user)
            const reviewerName = userContext.roleName === 'DEPARTMENT_HEAD' ? 'Department Head' : 'Administrator'

            // Get subject or course name
            const subjectOrCourseName = detailedAssessment.subject?.name || detailedAssessment.course?.name || 'N/A'

            // Send rejection email to each trainer who assessed sections
            for (const trainer of trainerAssessors) {
              try {
                await this.nodemailerService.sendRejectedAssessmentEmail(
                  trainer.email,
                  trainer.fullName,
                  detailedAssessment.name,
                  subjectOrCourseName,
                  detailedAssessment.template.name,
                  submissionDate,
                  reviewerName,
                  reviewDate,
                  body.comment || 'No specific comment provided.',
                  `${process.env.FRONTEND_URL || 'http://localhost:4000'}/assessments/${assessmentId}` // sửa lại chỗ này khi có URL đúng
                )
                console.log(`Rejection notification sent to trainer: ${trainer.fullName} (${trainer.email})`)
              } catch (individualEmailError) {
                console.error(`Failed to send rejection email to trainer ${trainer.fullName}:`, individualEmailError)
              }
            }
          } else if (detailedAssessment && trainerAssessors.length === 0) {
            // Fallback: No trainers assessed sections, log this case
            console.log(`Assessment ${assessmentId} rejected but no trainer assessors found. No rejection emails sent.`)
          }
        } catch (emailError) {
          // Log email error but don't fail the main operation
          console.error('Failed to send rejection emails:', emailError)
        }
      }

      // Generate PDF when assessment is approved
      if (body.action === 'APPROVED') {
        try {
          await this.renderAssessmentToPdf(assessmentId)
          console.log(`PDF generated successfully for assessment ${assessmentId}`)
        } catch (pdfError) {
          // Log PDF generation error but don't fail the approval
          console.error('Failed to generate PDF for approved assessment:', pdfError)
        }

        // Send email notification for approved assessment
        try {
          // Get detailed assessment information for email
          const detailedAssessment = await this.assessmentRepo.findById(assessmentId)

          if (detailedAssessment) {
            // Format dates for email
            const assessmentDate = new Date(detailedAssessment.occuranceDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })

            const approvalDate = new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })

            // Get subject or course name
            const subjectOrCourseName =
              detailedAssessment.subject?.name || detailedAssessment.course?.name || 'Assessment'

            await this.nodemailerService.sendApprovedAssessmentEmail(
              detailedAssessment.trainee.email,
              `${detailedAssessment.trainee.firstName} ${detailedAssessment.trainee.lastName}`.trim(),
              detailedAssessment.name,
              subjectOrCourseName,
              assessmentDate,
              approvalDate,
              `${process.env.FRONTEND_URL || 'http://localhost:4000'}/assessments/${assessmentId}`
            )

            console.log(`Approval notification email sent successfully to ${detailedAssessment.trainee.email}`)
          }
        } catch (emailError) {
          // Log email error but don't fail the main operation
          console.error('Failed to send approval notification email:', emailError)
        }
      }

      const actionMessage = body.action === 'APPROVED' ? 'approved' : 'rejected'

      return {
        success: true,
        message: `Assessment ${actionMessage} successfully`,
        data: {
          assessmentFormId: assessmentId,
          status: result.status,
          previousStatus: 'SUBMITTED',
          comment: result.comment,
          approvedById: result.approvedById,
          approvedAt: result.approvedAt,
          processedAt: result.updatedAt,
          processedBy: userContext.userId
        }
      }
    } catch (error: any) {
      // Handle specific known errors
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle any other unexpected errors
      console.error('Approve/reject assessment failed:', error)
      throw new BadRequestException('Failed to process assessment approval/rejection')
    }
  }

  /**
   * Get assessment PDF URL
   */
  async getAssessmentPdfUrl(
    assessmentId: string,
    userContext: { userId: string; roleName: string; departmentId?: string }
  ) {
    try {
      // Validate assessment exists and get PDF URL
      const assessmentForm = await this.assessmentRepo.findById(assessmentId)

      if (!assessmentForm) {
        throw new NotFoundException('Assessment form not found')
      }

      // Check if user has access to this assessment (same department)
      // Get user's department from database
      const user = await this.assessmentRepo.prismaClient.user.findUnique({
        where: { id: userContext.userId },
        select: { departmentId: true }
      })

      if (user?.departmentId) {
        const hasAccess = await this.assessmentRepo.checkUserAssessmentAccess(
          assessmentId,
          userContext.userId,
          user.departmentId
        )
        if (!hasAccess) {
          throw new ForbiddenException('You do not have access to this assessment')
        }
      }

      return {
        success: true,
        data: {
          assessmentFormId: assessmentId,
          pdfUrl: assessmentForm.pdfUrl,
          status: assessmentForm.status,
          hasPdf: !!assessmentForm.pdfUrl
        },
        message: 'Assessment PDF URL retrieved successfully'
      }
    } catch (error: any) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error
      }

      console.error('Get assessment PDF URL failed:', error)
      throw new BadRequestException('Failed to get assessment PDF URL')
    }
  }

  /**
   * Render DOCX template with provided data for testing purposes
   * Public API to test template rendering without going through approval process
   */
  async renderDocxTemplateForTesting(body: RenderDocxTemplateBodyType): Promise<RenderDocxTemplateResType> {
    try {
      // Download the template from the provided URL
      const templateBuffer = await this.downloadFileFromS3(body.templateUrl)

      // Render the template with provided data
      const renderedDocxBuffer = await this.renderDocxTemplate(templateBuffer, body.data)

      // Generate filename with timestamp for testing
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `test-template-${timestamp}.docx`

      // Convert buffer to base64 for response
      const base64Buffer = renderedDocxBuffer.toString('base64')

      return {
        success: true,
        message: 'DOCX template rendered successfully',
        data: {
          filename: filename,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: base64Buffer
        }
      }
    } catch (error: any) {
      console.error('DOCX template rendering for testing failed:', error)

      // Handle specific known errors
      if (error instanceof BadRequestException) {
        throw error
      }

      if (error.message?.includes('Failed to download')) {
        throw new BadRequestException('Failed to download template file from provided URL')
      }

      if (error.message?.includes('Template rendering failed')) {
        throw new BadRequestException(error.message)
      }

      throw new BadRequestException('Failed to render DOCX template')
    }
  }

  /**
   * Render DOCX template with image support for testing purposes
   * Public API to test template rendering with images from S3 URLs without going through approval process
   * Now uses the unified renderDocxTemplate method that handles both text and images
   */
  async renderDocxTemplateWithImagesForTesting(body: RenderDocxTemplateBodyType): Promise<RenderDocxTemplateResType> {
    try {
      // Download the template from the provided URL
      const templateBuffer = await this.downloadFileFromS3(body.templateUrl)

      // Render the template with provided data using unified method
      const renderedDocxBuffer = await this.renderDocxTemplate(templateBuffer, body.data)

      // Generate filename with timestamp for testing
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `test-template-with-mixed-data-${timestamp}.docx`

      // Convert buffer to base64 for response
      const base64Buffer = renderedDocxBuffer.toString('base64')

      return {
        success: true,
        message: 'DOCX template with mixed data (text + images) rendered successfully',
        data: {
          filename: filename,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: base64Buffer
        }
      }
    } catch (error: any) {
      console.error('DOCX template with mixed data rendering for testing failed:', error)

      // Handle specific known errors
      if (error instanceof BadRequestException) {
        throw error
      }

      if (error.message?.includes('Failed to download')) {
        throw new BadRequestException('Failed to download template file from provided URL')
      }

      if (error.message?.includes('Template rendering failed') || error.message?.includes('Image processing failed')) {
        throw new BadRequestException(error.message)
      }

      throw new BadRequestException('Failed to render DOCX template with mixed data')
    }
  }

  /**
   * Render assessment data into DOCX template and convert to PDF
   * Called after assessment is approved
   */
  private async renderAssessmentToPdf(assessmentId: string): Promise<string> {
    try {
      // Get assessment with all related data
      const assessmentForm = await this.assessmentRepo.getAssessmentWithTemplateAndValues(assessmentId)

      if (!assessmentForm || !(assessmentForm as any).template) {
        throw new NotFoundException('Assessment form or template not found')
      }

      // Process assessment result based on final score fields before rendering
      await this.processAssessmentResult(assessmentId, assessmentForm)

      // Get template schema and config URL
      const template = (assessmentForm as any).template
      const templateSchema = template.templateSchema as Record<string, any>
      const templateConfigUrl = template.templateConfig

      if (!templateConfigUrl) {
        throw new BadRequestException('Template config URL not found')
      }

      // Download DOCX template from S3
      const templateBuffer = await this.downloadFileFromS3(templateConfigUrl)

      // Build data object from assessment values (refresh after processing result)
      const assessmentData = await this.buildAssessmentDataFromValues(assessmentId, templateSchema)

      // DEBUG: Log schema after mapping data
      console.log('=== SCHEMA AFTER MAPPING DATA ===')
      console.log('Assessment ID:', assessmentId)
      console.log('Template Schema (original):', JSON.stringify(templateSchema, null, 2))
      console.log('Assessment Data (mapped):', JSON.stringify(assessmentData, null, 2))
      console.log('=== END SCHEMA DEBUG ===')

      // Render DOCX with data
      const renderedDocxBuffer = await this.renderDocxTemplate(templateBuffer, assessmentData)

      // Convert DOCX to PDF
      const pdfBuffer = await this.pdfConverterService['convertDocxBufferToPdf'](renderedDocxBuffer)

      // Upload PDF to S3 with proper filename
      const pdfUrl = await this.uploadPdfToS3(pdfBuffer, assessmentForm)
      console.log(`PDF uploaded to S3 with URL: ${pdfUrl}`)

      // Update assessment form with PDF URL
      const updatedAssessment = await this.assessmentRepo.updateAssessmentPdfUrl(assessmentId, pdfUrl)
      console.log(`Assessment form updated with PDF URL. Assessment ID: ${assessmentId}`)

      return pdfUrl
    } catch (error) {
      console.error('Failed to render assessment to PDF:', error)
      throw new BadRequestException('Failed to generate assessment PDF')
    }
  }

  /**
   * Process assessment result based on FINAL_SCORE fields and update AssessmentForm
   * This method handles 3 cases:
   * 1. Both FINAL_SCORE_NUM and FINAL_SCORE_TEXT exist
   * 2. Only FINAL_SCORE_TEXT exists
   * 3. Only FINAL_SCORE_NUM exists
   */
  private async processAssessmentResult(assessmentId: string, assessmentForm: any): Promise<void> {
    try {
      console.log(`=== Processing Assessment Result for ${assessmentId} ===`)
      console.log(`AssessmentForm IDs - subjectId: ${assessmentForm.subjectId}, courseId: ${assessmentForm.courseId}`)

      // Get all assessment values with field types
      const assessmentValues = await this.assessmentRepo.getAssessmentValues(assessmentId)

      // Find FINAL_SCORE_NUM and FINAL_SCORE_TEXT fields
      const finalScoreNumValue = assessmentValues.find((av) => av.templateField?.fieldType === 'FINAL_SCORE_NUM')
      const finalScoreTextValue = assessmentValues.find((av) => av.templateField?.fieldType === 'FINAL_SCORE_TEXT')

      console.log(`FINAL_SCORE_NUM value: ${finalScoreNumValue?.answerValue || 'null'}`)
      console.log(`FINAL_SCORE_TEXT value: ${finalScoreTextValue?.answerValue || 'null'}`)

      // Get pass score from subject or course - fetch directly from database to ensure we have the latest data
      let passScore: number | null = null

      // Priority: Subject first (if subjectId exists, ignore courseId)
      if (assessmentForm.subjectId) {
        const subject = await this.assessmentRepo.prismaClient.subject.findUnique({
          where: { id: assessmentForm.subjectId },
          select: { passScore: true }
        })
        passScore = subject?.passScore || null
        // console.log(`Assessment ${assessmentId} - Subject passScore: ${passScore}`)
      }
      // Only check course if no subject
      else if (assessmentForm.courseId) {
        const course = await this.assessmentRepo.prismaClient.course.findUnique({
          where: { id: assessmentForm.courseId },
          select: { passScore: true }
        })
        passScore = course?.passScore || null
        // console.log(`Assessment ${assessmentId} - Course passScore: ${passScore}`)
      }

      let resultScore: number | null = null
      let resultText: AssessmentResult = AssessmentResult.NOT_APPLICABLE

      // Case 1: Both FINAL_SCORE_NUM and FINAL_SCORE_TEXT exist
      if (finalScoreNumValue && finalScoreTextValue && passScore !== null) {
        const scoreValue = parseFloat(finalScoreNumValue.answerValue || '0')
        resultScore = scoreValue

        // Determine PASS/FAIL based on pass score
        const isPassed = scoreValue >= passScore
        resultText = isPassed ? AssessmentResult.PASS : AssessmentResult.FAIL

        // console.log(`Assessment ${assessmentId} - Case 1: Both fields exist`)
        // console.log(`- Score: ${scoreValue}, PassScore: ${passScore}`)
        // console.log(`- Calculation: ${scoreValue} >= ${passScore} = ${isPassed}`)
        // console.log(`- Result: ${resultText}`)

        // Update FINAL_SCORE_TEXT field with PASS/FAIL
        await this.assessmentRepo.prismaClient.assessmentValue.update({
          where: { id: finalScoreTextValue.id },
          data: {
            answerValue: resultText
          }
        })

        // console.log(`Updated FINAL_SCORE_TEXT field to: ${resultText} for assessment ${assessmentId}`)
      }
      // Case 2: Only FINAL_SCORE_TEXT exists
      else if (finalScoreTextValue && !finalScoreNumValue) {
        // User manually enters text, read the value they entered
        resultScore = null

        // Read the user's FINAL_SCORE_TEXT value
        const textValue = finalScoreTextValue.answerValue?.toUpperCase()
        if (textValue === 'PASS') {
          resultText = AssessmentResult.PASS
        } else if (textValue === 'FAIL') {
          resultText = AssessmentResult.FAIL
        } else {
          resultText = AssessmentResult.NOT_APPLICABLE
        }

        // console.log(`Assessment ${assessmentId} has only FINAL_SCORE_TEXT field - resultText: ${resultText}`)
      }
      // Case 3: Only FINAL_SCORE_NUM exists AND passScore is defined
      else if (finalScoreNumValue && !finalScoreTextValue && passScore !== null) {
        const scoreValue = parseFloat(finalScoreNumValue.answerValue || '0')
        resultScore = scoreValue

        // Determine PASS/FAIL based on pass score
        const isPassed = scoreValue >= passScore
        resultText = isPassed ? AssessmentResult.PASS : AssessmentResult.FAIL

        // console.log(`Assessment ${assessmentId} - Case 3: Only FINAL_SCORE_NUM field`)
        // console.log(`- Score: ${scoreValue}, PassScore: ${passScore}`)
        // console.log(`- Calculation: ${scoreValue} >= ${passScore} = ${isPassed}`)
        // console.log(`- Result: ${resultText}`)
      }
      // Case 4: Only FINAL_SCORE_NUM exists BUT no passScore is defined
      else if (finalScoreNumValue && !finalScoreTextValue && passScore === null) {
        const scoreValue = parseFloat(finalScoreNumValue.answerValue || '0')
        resultScore = scoreValue
        // Since no passScore is defined, cannot determine PASS/FAIL
        resultText = AssessmentResult.NOT_APPLICABLE

        // console.log(
        //   `Assessment ${assessmentId} has FINAL_SCORE_NUM but no passScore defined - score: ${scoreValue}, cannot calculate result`
        // )
      }

      // Prepare comment for cases where result cannot be calculated due to missing passScore
      let comment: string | null = null
      if (finalScoreNumValue && passScore === null) {
        comment =
          'Cannot calculate result because Course does not have pass Score defined, ask Administrator to check through report'
      }

      // Update AssessmentForm with calculated results
      await this.assessmentRepo.prismaClient.assessmentForm.update({
        where: { id: assessmentId },
        data: {
          resultScore: resultScore,
          resultText: resultText,
          ...(comment && { comment: comment })
        }
      })

      // console.log(`Updated AssessmentForm ${assessmentId} - resultScore: ${resultScore}, resultText: ${resultText}`)
    } catch (error) {
      console.error('Failed to process assessment result:', error)
      throw new BadRequestException('Failed to process assessment result')
    }
  }

  /**
   * Download file from S3 URL
   */
  private async downloadFileFromS3(url: string): Promise<Buffer> {
    try {
      // Extract S3 key from URL
      const urlParts = new URL(url)
      const key = urlParts.pathname.substring(1) // Remove leading slash

      // Download file from S3
      const fileStream = await this.s3Service.getObject(key)

      // Convert stream to buffer
      const chunks: Buffer[] = []
      return new Promise((resolve, reject) => {
        fileStream.on('data', (chunk) => chunks.push(chunk))
        fileStream.on('end', () => resolve(Buffer.concat(chunks)))
        fileStream.on('error', reject)
      })
    } catch (error) {
      console.error('Failed to download file from S3:', error)
      throw new BadRequestException('Failed to download template file')
    }
  }

  /**
   * Build assessment data object from assessment values using template schema as base structure
   * Use parent context to handle fields with duplicate names in different parent sections
   * Pre-populates AssessmentValue records with signature data before schema mapping
   */
  private async buildAssessmentDataFromValues(
    assessmentId: string,
    templateSchema: Record<string, any>
  ): Promise<Record<string, any>> {
    // Step 1: Pre-populate SIGNATURE_IMG fields with trainer signatureImageUrl
    await this.prePopulateSignatureFields(assessmentId)

    // Step 2: Get all assessment values (now with pre-populated signature data)
    const assessmentValues = await this.assessmentRepo.getAssessmentValues(assessmentId)

    // Step 3: Get assessment form info for fallback scenarios only
    const assessmentForm = await this.assessmentRepo.prismaClient.assessmentForm.findUnique({
      where: { id: assessmentId },
      include: {
        trainee: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true
          }
        },
        sections: {
          include: {
            assessedBy: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true
              }
            },
            templateSection: {
              select: {
                id: true,
                editBy: true
              }
            }
          }
        }
      }
    })

    if (!assessmentForm) {
      throw new Error('Assessment form not found')
    }

    // Step 4: Create section mapping for fallback scenarios
    const sectionAssessorMap = new Map<string, any>()
    for (const section of assessmentForm.sections) {
      sectionAssessorMap.set(section.id, {
        assessedBy: section.assessedBy,
        editBy: section.templateSection.editBy
      })
    }

    // Get section mapping for assessment values
    const assessmentValuesWithSections = await this.assessmentRepo.prismaClient.assessmentValue.findMany({
      where: {
        assessmentSection: {
          assessmentFormId: assessmentId
        }
      },
      select: {
        id: true,
        assessmentSectionId: true
      }
    })

    const valueToSectionMap = new Map<string, string>()
    assessmentValuesWithSections.forEach((av) => {
      valueToSectionMap.set(av.id, av.assessmentSectionId)
    })

    // Step 5: Create field path mapping - all data comes from AssessmentValue now
    const pathValueMap = new Map<string, any>()

    assessmentValues.forEach((assessmentValue) => {
      if (assessmentValue.templateField && assessmentValue.templateField.fieldName) {
        let finalValue = this.parseAssessmentValue(assessmentValue.answerValue, assessmentValue.templateField.fieldType)

        // Only do fallbacks for SIGNATURE_DRAW fields (SIGNATURE_IMG was pre-populated)
        if (
          (finalValue === null || finalValue === '') &&
          assessmentValue.templateField.fieldType === 'SIGNATURE_DRAW'
        ) {
          const roleRequired = assessmentValue.templateField.roleRequired
          const sectionId = valueToSectionMap.get(assessmentValue.id)
          const sectionInfo = sectionId ? sectionAssessorMap.get(sectionId) : null

          if (roleRequired === 'TRAINER' && sectionInfo?.assessedBy) {
            // TRAINER SIGNATURE_DRAW: fallback to assessor's full name
            finalValue =
              `${sectionInfo.assessedBy.firstName} ${sectionInfo.assessedBy.middleName || ''} ${sectionInfo.assessedBy.lastName}`.trim()
          } else if (roleRequired === 'TRAINEE') {
            // TRAINEE SIGNATURE_DRAW: fallback to trainee's full name
            finalValue =
              `${assessmentForm.trainee.firstName} ${assessmentForm.trainee.middleName || ''} ${assessmentForm.trainee.lastName}`.trim()
          }
        }

        // If still null/empty for IMAGE fields, set to empty string
        if ((finalValue === null || finalValue === '') && assessmentValue.templateField.fieldType === 'IMAGE') {
          finalValue = ''
        }

        // Build field path from parent hierarchy to ensure uniqueness
        // e.g., "Apk_Grade.grade1", "Com_Grade.grade1", "root.isPf"
        const fieldPath = this.buildFieldPath(assessmentValue.templateField)
        pathValueMap.set(fieldPath, finalValue)

        // Also set simple fieldName for root-level fields (backward compatibility)
        if (!assessmentValue.templateField.parentId) {
          pathValueMap.set(assessmentValue.templateField.fieldName, finalValue)
        }
      }
    })

    // Step 6: Use templateSchema as base and populate with actual values using path mapping
    const populatedSchema = this.populateSchemaWithPathValues(templateSchema, pathValueMap)

    // Convert null values to empty strings in nested objects (PART/CHECK_BOX fields)
    return this.convertNullsToEmptyStringsInNestedObjects(populatedSchema)
  }

  /**
   * Pre-populate SIGNATURE_IMG fields with trainer signatureImageUrl in AssessmentValue records
   * This ensures all data comes from AssessmentValue, not direct fallbacks during schema mapping
   */
  private async prePopulateSignatureFields(assessmentId: string): Promise<void> {
    // Get all SIGNATURE_IMG fields for TRAINER with empty/null values
    const signatureImgFields = await this.assessmentRepo.prismaClient.assessmentValue.findMany({
      where: {
        assessmentSection: {
          assessmentFormId: assessmentId
        },
        templateField: {
          fieldType: 'SIGNATURE_IMG',
          roleRequired: 'TRAINER'
        },
        OR: [{ answerValue: null }, { answerValue: '' }]
      },
      include: {
        assessmentSection: {
          include: {
            assessedBy: {
              select: {
                signatureImageUrl: true,
                firstName: true,
                middleName: true,
                lastName: true
              }
            }
          }
        },
        templateField: {
          select: {
            fieldType: true,
            roleRequired: true
          }
        }
      }
    })

    // Update each SIGNATURE_IMG field with trainer's signatureImageUrl or fallback to name
    const updatePromises = signatureImgFields.map(async (field) => {
      let signatureValue = ''

      if (field.assessmentSection.assessedBy?.signatureImageUrl) {
        // Use trainer's signature image URL
        signatureValue = field.assessmentSection.assessedBy.signatureImageUrl
      } else if (field.assessmentSection.assessedBy) {
        // Fallback to trainer's full name if no signature image
        signatureValue =
          `${field.assessmentSection.assessedBy.firstName} ${field.assessmentSection.assessedBy.middleName || ''} ${field.assessmentSection.assessedBy.lastName}`.trim()
      }

      // Update the assessment value if we have a signature value
      if (signatureValue) {
        return this.assessmentRepo.prismaClient.assessmentValue.update({
          where: { id: field.id },
          data: { answerValue: signatureValue }
        })
      }
    })

    // Execute all updates
    await Promise.all(updatePromises.filter(Boolean))

    console.log(
      `Pre-populated ${signatureImgFields.length} TRAINER SIGNATURE_IMG fields for assessment ${assessmentId}`
    )
  }

  /**
   * Build field path from parent hierarchy to handle duplicate field names
   * Examples: "Apk_Grade.grade1", "Com_Grade.grade2", "isPf" (root level)
   */
  private buildFieldPath(templateField: any): string {
    const pathSegments: string[] = []

    // Build path from current field up to root
    let currentField = templateField
    while (currentField) {
      pathSegments.unshift(currentField.fieldName)
      currentField = currentField.parent
    }

    // Return full path (e.g., "Apk_Grade.grade1") or just fieldName for root level
    return pathSegments.length > 1 ? pathSegments.join('.') : pathSegments[0]
  }

  /**
   * Populate template schema with assessment values based on path matching
   * The templateSchema already has the correct nested structure, we just fill in the values
   */
  private populateSchemaWithPathValues(
    schema: Record<string, any>,
    pathValueMap: Map<string, any>
  ): Record<string, any> {
    // Deep clone the template schema to avoid modifying the original
    const result = JSON.parse(JSON.stringify(schema))

    // Recursively populate the schema with assessment values using path context
    this.populateObjectWithPathValues(result, pathValueMap, '')

    return result
  }

  /**
   * Populate template schema with assessment values based on fieldName matching
   * The templateSchema already has the correct nested structure, we just fill in the values
   */
  private populateSchemaWithAssessmentValues(
    schema: Record<string, any>,
    valueMap: Map<string, any>
  ): Record<string, any> {
    // Deep clone the template schema to avoid modifying the original
    const result = JSON.parse(JSON.stringify(schema))

    // Recursively populate the schema with assessment values
    this.populateObjectWithValues(result, valueMap)

    return result
  }

  /**
   * Recursively populate object with values using path-based mapping
   * Handle nested structures like Apk_Grade.grade1, Com_Grade.grade1 correctly
   */
  private populateObjectWithPathValues(obj: any, pathValueMap: Map<string, any>, currentPath: string): void {
    if (Array.isArray(obj)) {
      // Handle arrays - recurse into each element
      obj.forEach((item) => {
        if (typeof item === 'object' && item !== null) {
          this.populateObjectWithPathValues(item, pathValueMap, currentPath)
        }
      })
    } else if (typeof obj === 'object' && obj !== null) {
      // Handle objects
      for (const [key, value] of Object.entries(obj)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key

        if (Array.isArray(value)) {
          // Array property - recurse into array
          this.populateObjectWithPathValues(value, pathValueMap, newPath)
        } else if (typeof value === 'object' && value !== null) {
          // Nested object - recurse with updated path
          this.populateObjectWithPathValues(value, pathValueMap, newPath)
        } else {
          // Leaf field - check for value using full path first, then simple key
          if (pathValueMap.has(newPath)) {
            // Found exact path match (e.g., "Apk_Grade.grade1")
            obj[key] = pathValueMap.get(newPath)
          } else if (pathValueMap.has(key)) {
            // Fallback to simple fieldName for root-level fields
            obj[key] = pathValueMap.get(key)
          }
          // If no value found, keep the default value from templateSchema
        }
      }
    }
  }

  /**
   * Recursively populate object with values from valueMap based on fieldName (legacy method)
   * Handle arrays and nested objects properly for PART structures
   */
  private populateObjectWithValues(obj: any, valueMap: Map<string, any>): void {
    if (Array.isArray(obj)) {
      // Handle arrays - recurse into each element
      obj.forEach((item) => {
        if (typeof item === 'object' && item !== null) {
          this.populateObjectWithValues(item, valueMap)
        }
      })
    } else if (typeof obj === 'object' && obj !== null) {
      // Handle objects
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          // Array property - recurse into array
          this.populateObjectWithValues(value, valueMap)
        } else if (typeof value === 'object' && value !== null) {
          // Nested object - recurse
          this.populateObjectWithValues(value, valueMap)
        } else {
          // Leaf field - check if we have a value for this fieldName
          if (valueMap.has(key)) {
            const assessmentValue = valueMap.get(key)
            // Set the actual assessment value
            obj[key] = assessmentValue
          }
          // If no value found, keep the default value from templateSchema
        }
      }
    }
  }

  /**
   * Parse assessment value based on field type and auto-detect data types
   * IMPORTANT: If value is null/undefined, return empty string for template mapping
   * This ensures null values appear as "fieldName": "" in the final JSON for docxtemplater
   */
  private parseAssessmentValue(value: string | null | undefined, fieldType?: string): any {
    // CRITICAL: Convert null/undefined values to empty strings for template mapping
    // This will result in "fieldName": "" in the JSON output for docxtemplater
    if (value === null || value === undefined) return ''

    // If value is empty string, keep it as empty string
    if (value === '') return ''

    // Handle specific field types first - ONLY convert when field type is explicit
    if (fieldType === 'TOGGLE' || fieldType === 'SECTION_CONTROL_TOGGLE') {
      return value.toLowerCase() === 'true'
    }

    if (fieldType === 'NUMBER' || fieldType === 'FINAL_SCORE_NUM') {
      const num = Number(value)
      return isNaN(num) ? null : num
    }

    // Handle signature and image field types - these are strings (URLs or names)
    if (fieldType === 'IMAGE' || fieldType === 'SIGNATURE_DRAW' || fieldType === 'SIGNATURE_IMG') {
      return value // Return as string (URL for images/signature images, name for signature draws)
    }

    // Note: CHECK_BOX is a parent field (like PART) that contains child fields
    // It doesn't have a value itself, only its children have values
    // So CHECK_BOX fields are not processed here - only their TEXT children are

    // For other field types, do NOT auto-convert boolean or number
    // Only convert to actual data types when field type explicitly requires it
    // This prevents "true"/"false" strings from being converted to boolean unintentionally

    // Return as string for all other field types (TEXT, VALUE_LIST, etc.)
    return value
  }

  /**
   * Convert null values to empty strings in nested objects (PART/CHECK_BOX fields)
   * This ensures proper rendering in DOCX templates where null values cause issues
   */
  private convertNullsToEmptyStringsInNestedObjects(obj: any): any {
    if (Array.isArray(obj)) {
      // Handle arrays - recurse into each element
      return obj.map((item) => this.convertNullsToEmptyStringsInNestedObjects(item))
    } else if (typeof obj === 'object' && obj !== null) {
      const result: any = {}

      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // This is a nested object (likely PART/CHECK_BOX field)
          // Recurse and convert nulls to empty strings in nested object
          result[key] = this.convertNullsInObject(value)
        } else {
          // Keep the value as-is for root level fields (preserve nulls for top-level)
          result[key] = value
        }
      }

      return result
    }

    return obj
  }

  /**
   * Convert all null values to empty strings in an object
   * Used for nested objects (PART/CHECK_BOX children)
   */
  private convertNullsInObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertNullsToEmptyStringsInNestedObjects(item))
    } else if (typeof obj === 'object' && obj !== null) {
      const result: any = {}

      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) {
          // Convert null/undefined to empty string in nested objects
          result[key] = ''
        } else if (typeof value === 'object') {
          // Recurse for deeper nesting
          result[key] = this.convertNullsInObject(value)
        } else {
          // Keep non-null values as-is
          result[key] = value
        }
      }

      return result
    }

    return obj === null || obj === undefined ? '' : obj
  }

  /**
   * Render DOCX template with data and image support using docxtemplater
   * Supports both regular text fields and image fields from S3 URLs
   */
  private async renderDocxTemplate(templateBuffer: Buffer, data: Record<string, any>): Promise<Buffer> {
    try {
      const PizZip = require('pizzip')
      const Docxtemplater = require('docxtemplater')
      const ImageModule = require('docxtemplater-image-module-free')
      const https = require('https')
      const sizeOf = require('image-size')

      // Helper function to download image from S3 URL
      const downloadImageFromUrl = (url: string): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
          https
            .get(url, (response: any) => {
              if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download image from ${url}, status: ${response.statusCode}`))
              }

              const chunks: Buffer[] = []
              response.on('data', (chunk: Buffer) => chunks.push(chunk))
              response.on('end', () => resolve(Buffer.concat(chunks)))
              response.on('error', reject)
            })
            .on('error', reject)
        })
      }

      // Check if data contains any image fields (URLs starting with http/https)
      const hasImages = Object.values(data).some(
        (value) => typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))
      )

      if (hasImages) {
        // Use image module for templates with images
        // console.log('Template contains images, using image module')

        // Configure image module options
        const imageOpts = {
          centered: false, // Set to true to center all images
          fileType: 'docx', // Document type

          // Async function to get image from S3 URL
          getImage: async (tagValue: string, tagName: string) => {
            try {
              // Only process if the value looks like a URL
              if (typeof tagValue === 'string' && (tagValue.startsWith('http://') || tagValue.startsWith('https://'))) {
                // console.log(`Downloading image for tag ${tagName}: ${tagValue}`)
                const imageBuffer = await downloadImageFromUrl(tagValue)
                // console.log(`Successfully downloaded image for tag ${tagName}, size: ${imageBuffer.length} bytes`)
                return imageBuffer
              }
              // If not a URL, return null (will be handled as regular text)
              return null
            } catch (error) {
              console.error(`Failed to download image for tag ${tagName} from ${tagValue}:`, error)
              throw new Error(`Image processing failed for ${tagName}: ${error.message}`)
            }
          },

          // Function to determine image size
          getSize: (img: Buffer, tagValue: string, tagName: string) => {
            try {
              const dimensions = sizeOf(img)
              console.log(`Image ${tagName} dimensions: ${dimensions.width}x${dimensions.height}`)

              // Set default size (self configurable)
              let width = dimensions.width
              let height = dimensions.height
              const maxWidth = 87
              const maxHeight = 60

              // Scale down if image is too large
              if (width > maxWidth || height > maxHeight) {
                const widthRatio = maxWidth / width
                const heightRatio = maxHeight / height
                const ratio = Math.min(widthRatio, heightRatio)

                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
                console.log(`Scaled image ${tagName} to: ${width}x${height}`)
              }

              return [width, height]
            } catch (error) {
              console.error(`Failed to get image size for ${tagName}:`, error)
              // Return default size if size detection fails
              return [87, 60]
            }
          }
        }

        // Create image module instance
        const imageModule = new ImageModule(imageOpts)

        // Create zip instance from template buffer
        const zip = new PizZip(templateBuffer)

        // Create docxtemplater instance with image module
        const doc = new Docxtemplater().loadZip(zip).attachModule(imageModule).compile()

        console.log('Rendering DOCX template with mixed data (text + images):', Object.keys(data))

        // Render template with data (supports async operations)
        await doc.resolveData(data)
        doc.render()

        // Generate final document buffer
        const buffer = doc.getZip().generate({
          type: 'nodebuffer',
          compression: 'DEFLATE'
        })

        console.log('DOCX template with mixed data rendered successfully')
        return buffer
      } else {
        // Use regular docxtemplater for text-only templates
        console.log('Template contains only text data, using regular docxtemplater')

        // Load template with PizZip (unzip the content of the file)
        const zip = new PizZip(templateBuffer)

        // Custom nullGetter to return empty string instead of "undefined" for null/undefined values
        const nullGetter = (part: any, scopeManager: any) => {
          // For all cases (simple tags, raw XML, etc.), return empty string
          return ''
        }

        // Parse the template - this throws an error if template is invalid
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          nullGetter: nullGetter
        })

        // Render the document with data
        doc.render(data)

        // Get the output document as Node.js buffer
        const buffer = doc.toBuffer()

        console.log('DOCX template with text data rendered successfully')
        return buffer
      }
    } catch (error: any) {
      console.error('DOCX template rendering failed:', error)

      // Handle image processing errors
      if (error.message?.includes('Image processing failed')) {
        throw new BadRequestException(`Template rendering failed: ${error.message}`)
      }

      // Handle specific docxtemplater errors
      if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors.map((err: any) => `${err.name}: ${err.message}`).join('; ')
        throw new BadRequestException(`Template rendering failed: ${errorMessages}`)
      }

      throw new BadRequestException(`Failed to render document template: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Upload PDF to S3 with proper filename format and return URL
   * Format: Final Assessment_traineeEid_courseCode/subjectCode_occurenceDate
   */
  private async uploadPdfToS3(pdfBuffer: Buffer, assessmentForm: any): Promise<string> {
    try {
      // Generate filename based on assessment data
      const filename = this.generateAssessmentPdfFilename(assessmentForm)
      const key = `assessments/pdf/${filename}`

      console.log(`Uploading PDF with filename: ${filename}`)

      const uploadResult = await this.s3Service.uploadBuffer({
        key,
        body: pdfBuffer,
        contentType: 'application/pdf'
      })

      return uploadResult.url || this.s3Service.getObjectUrl(key)
    } catch (error) {
      console.error('Failed to upload PDF to S3:', error)
      throw new BadRequestException('Failed to upload PDF file')
    }
  }

  /**
   * Generate PDF filename based on assessment form data
   * Format: Final Assessment_traineeEid_courseCode/subjectCode_occurenceDate.pdf
   */
  private generateAssessmentPdfFilename(assessmentForm: any): string {
    try {
      // Get trainee EID
      const traineeEid = assessmentForm.trainee?.eid || 'UNKNOWN'

      // Get course/subject code (prioritize subject over course)
      let scopeCode = 'UNKNOWN'
      if (assessmentForm.subjectId && assessmentForm.subject?.code) {
        scopeCode = assessmentForm.subject.code
      } else if (assessmentForm.courseId && assessmentForm.course?.code) {
        scopeCode = assessmentForm.course.code
      }

      // Format occurrence date (YYYY-MM-DD)
      let formattedDate = 'UNKNOWN'
      if (assessmentForm.occuranceDate) {
        const date = new Date(assessmentForm.occuranceDate)
        formattedDate = date.toISOString().split('T')[0] // YYYY-MM-DD format
      }

      // Generate filename with timestamp to avoid overwrite
      const timestamp = Date.now()
      const filename = `Final Assessment_${traineeEid}_${scopeCode}_${formattedDate}_${timestamp}.pdf`

      // Sanitize filename (remove invalid characters)
      return filename.replace(/[<>:"/\\|?*]/g, '_')
    } catch (error) {
      console.error('Error generating PDF filename:', error)
      // Fallback filename
      return `Final_Assessment_${Date.now()}.pdf`
    }
  }

  /**
   * Get assessment events - grouped assessment forms by name, subject/course, and occurrence date
   */
  async getAssessmentEvents(
    query: GetAssessmentEventsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetAssessmentEventsResType> {
    try {
      const result = await this.assessmentRepo.getAssessmentEvents(
        query.page,
        query.limit,
        query.status,
        query.subjectId,
        query.courseId,
        query.templateId,
        query.fromDate,
        query.toDate,
        query.search
      )

      return result
    } catch (error) {
      console.error('Get assessment events failed:', error)

      if (error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException('Failed to get assessment events')
    }
  }

  /**
   * Get assessment events for current user based on their role (TRAINER/TRAINEE) and assignments
   */
  async getUserAssessmentEvents(
    query: GetUserAssessmentEventsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetUserAssessmentEventsResType> {
    try {
      const result = await this.assessmentRepo.getUserAssessmentEvents(
        currentUser.userId,
        currentUser.roleName,
        query.page,
        query.limit,
        query.courseId,
        query.subjectId,
        query.search
      )

      return result
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error
      }

      throw new BadRequestException('Failed to get user assessment events')
    }
  }

  /**
   * Update assessment event basic info (name and/or occurrence date)
   */
  async updateAssessmentEvent(
    params: UpdateAssessmentEventParamsType,
    body: UpdateAssessmentEventBodyType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<UpdateAssessmentEventResType> {
    try {
      const result = await this.assessmentRepo.updateAssessmentEvent(
        params.name,
        params.subjectId,
        params.courseId,
        params.occuranceDate,
        params.templateId,
        body
      )

      return result
    } catch (error: any) {
      // Handle specific known errors
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error
      }

      // Handle custom repository errors
      if (
        error.message?.includes('NOT_STARTED status') ||
        error.message?.includes('occurrence date has already passed') ||
        error.message?.includes('must be in the future')
      ) {
        throw new BadRequestException(error.message)
      }

      console.error('Update assessment event failed:', error)
      throw new BadRequestException('Failed to update assessment event')
    }
  }

  /**
   * Get assessments for a specific event in a subject
   * Combines event validation with assessment listing in the same response format as getSubjectAssessments
   */
  async getEventSubjectAssessments(
    body: GetEventSubjectAssessmentsBodyType,
    query: GetEventSubjectAssessmentsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetEventSubjectAssessmentsResType> {
    try {
      const result = await this.assessmentRepo.getEventSubjectAssessments(
        body.subjectId,
        body.templateId,
        body.occuranceDate,
        currentUser.userId,
        currentUser.roleName,
        query.page,
        query.limit,
        query.status,
        query.search
      )

      return result
    } catch (error) {
      console.error('Get event subject assessments failed:', error)

      if (error.message === 'Event not found in subject') {
        throw new NotFoundException('Assessment event not found in the specified subject')
      }

      if (error.message === 'Trainer is not assigned to this subject') {
        throw new ForbiddenException('You are not assigned to this subject')
      }

      if (error.message === 'Subject not found') {
        throw SubjectNotFoundException
      }

      if (error.message === 'Access denied') {
        throw new ForbiddenException('You do not have permission to access assessments in this subject')
      }

      throw new InternalServerErrorException('Failed to get event subject assessments')
    }
  }

  /**
   * Get assessments for a specific event in a course
   * Combines event validation with assessment listing in the same response format as getCourseAssessments
   */
  async getEventCourseAssessments(
    body: GetEventCourseAssessmentsBodyType,
    query: GetEventCourseAssessmentsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetEventCourseAssessmentsResType> {
    try {
      const result = await this.assessmentRepo.getEventCourseAssessments(
        body.courseId,
        body.templateId,
        body.occuranceDate,
        currentUser.userId,
        currentUser.roleName,
        query.page,
        query.limit,
        query.status,
        query.search
      )

      return result
    } catch (error) {
      console.error('Get event course assessments failed:', error)

      if (error.message === 'Event not found in course') {
        throw new NotFoundException('Assessment event not found in the specified course')
      }

      if (error.message === 'Trainer is not assigned to this course') {
        throw new ForbiddenException('You are not assigned to this course')
      }

      if (error.message === 'Course not found') {
        throw CourseNotFoundException
      }

      if (error.message === 'Access denied') {
        throw new ForbiddenException('You do not have permission to access assessments in this course')
      }

      throw new InternalServerErrorException('Failed to get event course assessments')
    }
  }

  /**
   * Archive assessment event by cancelling all assessments in NOT_STARTED status
   * Events are identified by subjectId/courseId, templateId, and occuranceDate
   */
  async archiveAssessmentEvent(
    body: ArchiveAssessmentEventBodyType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<ArchiveAssessmentEventResType> {
    try {
      const result = await this.assessmentRepo.archiveAssessmentEvent(
        body.subjectId,
        body.courseId,
        body.templateId,
        body.occuranceDate
      )

      return result
    } catch (error: any) {
      // Handle specific known errors
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error
      }

      // Handle custom repository errors
      if (
        error.message?.includes('Either subjectId or courseId must be provided') ||
        error.message?.includes('No assessments found for the specified event') ||
        error.message?.includes('Cannot archive event') ||
        error.message?.includes('not in NOT_STARTED status')
      ) {
        throw new BadRequestException(error.message)
      }

      console.error('Archive assessment event failed:', error)
      throw new InternalServerErrorException('Failed to archive assessment event')
    }
  }
}

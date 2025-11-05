import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common'
import { CourseStatus, SubjectStatus } from '@prisma/client'
import { AssessmentRepo } from './assessment.repo'
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
  UpdateAssessmentValuesResType
} from './assessment.model'
import {
  TemplateNotFoundException,
  TemplateNotActiveException,
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
  constructor(private readonly assessmentRepo: AssessmentRepo) {}

  /**
   * Create assessments for specific trainees
   */
  async createAssessments(
    data: CreateAssessmentBodyType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<CreateAssessmentResType> {
    try {
      // Step 1: Validate template exists and is active
      const template = await this.assessmentRepo.getTemplateWithStructure(data.templateId)
      if (!template) {
        throw TemplateNotFoundException
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
        throw new Error('Either subjectId or courseId must be provided')
      }

      // Step 3: Validate department consistency
      if (template.departmentId !== entityDepartmentId) {
        throw TemplateDepartmentMismatchException
      }

      // Step 4: Validate occurrence date is after start date (no end date restriction)
      const occurrenceDate = new Date(data.occuranceDate)
      
      if (occurrenceDate < startDate) {
        throw OccurrenceDateBeforeStartException(startDate, data.subjectId ? 'subject' : 'course')
      }

      // Step 5: Validate trainees
      const validTrainees = await this.assessmentRepo.validateTrainees(
        data.traineeIds,
        data.subjectId,
        data.courseId
      )

      // Check if all requested trainees were found and valid
      const foundTraineeIds = validTrainees.map(t => t.id)
      const missingTraineeIds = data.traineeIds.filter(id => !foundTraineeIds.includes(id))

      if (missingTraineeIds.length > 0) {
        // Get more details about missing trainees
        const allRequestedTrainees = await this.getAllTraineeDetails(data.traineeIds)
        const missingTrainees = allRequestedTrainees.filter(t => missingTraineeIds.includes(t.id))
        
        const notFoundTrainees = missingTrainees.filter(t => !t.exists)
        const invalidRoleTrainees = missingTrainees.filter(t => t.exists && t.role !== 'TRAINEE')
        const inactiveTrainees = missingTrainees.filter(t => t.exists && t.role === 'TRAINEE' && !t.isActive)
        const notEnrolledTrainees = missingTrainees.filter(t => 
          t.exists && t.role === 'TRAINEE' && t.isActive && !t.isEnrolled
        )

        if (notFoundTrainees.length > 0) {
          throw TraineeNotFoundException(notFoundTrainees.map(t => t.id))
        }
        if (invalidRoleTrainees.length > 0) {
          throw TraineeInvalidRoleException(invalidRoleTrainees.map(t => t.id))
        }
        if (inactiveTrainees.length > 0) {
          throw TraineeNotActiveException(inactiveTrainees.map(t => t.id))
        }
        if (notEnrolledTrainees.length > 0) {
          throw TraineeNotEnrolledException(
            notEnrolledTrainees.map(t => t.id),
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
        throw TraineeAssessmentExistsException(
          existingAssessments,
          data.subjectId ? 'subject' : 'course'
        )
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
      const createdAssessments = await this.assessmentRepo.createAssessments(
        data,
        templateSections,
        currentUser.userId
      )

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
      if (error.name === 'BadRequestException' || 
          error.name === 'NotFoundException' || 
          error.name === 'ForbiddenException' ||
          error.name === 'ConflictException' ||
          error.name === 'UnprocessableEntityException') {
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
      // Step 1: Validate template exists and is active
      const template = await this.assessmentRepo.getTemplateWithStructure(data.templateId)
      if (!template) {
        throw TemplateNotFoundException
      }

      // Step 2: Validate subject or course and get enrolled trainees
      let subject = null
      let course = null
      let entityDepartmentId = ''
      let startDate: Date
      let endDate: Date
      let enrolledTrainees: Array<{
        id: string;
        eid: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
        email: string;
        enrollmentStatus: string;
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
        throw new Error('Either subjectId or courseId must be provided')
      }

      // Step 3: Check if any trainees are enrolled
      // For course-level assessments: trainees enrolled in at least one active subject in the course
      if (enrolledTrainees.length === 0) {
        throw NoEnrolledTraineesFoundException(
          data.subjectId ? 'subject' : 'course',
          entityInfo.name
        )
      }

      // Step 4: Filter out excluded trainees if specified
      const excludeIds = data.excludeTraineeIds || []
      const eligibleTrainees = enrolledTrainees.filter(trainee => !excludeIds.includes(trainee.id))

      if (eligibleTrainees.length === 0) {
        throw AllTraineesExcludedException(enrolledTrainees.length)
      }

      // Step 5: Validate template department consistency
      if (template.departmentId !== entityDepartmentId) {
        throw TemplateDepartmentMismatchException
      }

      // Step 6: Validate occurrence date is after start date (no end date restriction)
      const occurrenceDate = new Date(data.occuranceDate)
      
      if (occurrenceDate < startDate) {
        throw OccurrenceDateBeforeStartException(startDate, data.subjectId ? 'subject' : 'course')
      }

      // Step 7: Check for existing assessments and filter out trainees who already have assessments
      const traineeIds = eligibleTrainees.map(t => t.id)
      const existingAssessments = await this.assessmentRepo.checkTraineeAssessmentExists(
        traineeIds,
        data.templateId,
        data.occuranceDate
      )

      // Filter out trainees who already have assessments
      const existingTraineeIds = existingAssessments.map(d => d.traineeId)
      const finalTraineeIds = traineeIds.filter(id => !existingTraineeIds.includes(id))
      const finalTrainees = eligibleTrainees.filter(t => finalTraineeIds.includes(t.id))

      // Track skipped trainees for response
      const skippedTrainees = [
        // Excluded trainees
        ...enrolledTrainees
          .filter(t => excludeIds.includes(t.id))
          .map(t => ({
            traineeId: t.id,
            traineeName: `${t.firstName} ${t.lastName}`.trim(),
            reason: 'Manually excluded from assessment creation'
          })),
        // Existing assessments
        ...existingAssessments.map(d => ({
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

      const createdAssessments = await this.assessmentRepo.createAssessments(
        bulkData,
        templateSections,
        currentUser.userId
      )

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
      if (error.name === 'BadRequestException' || 
          error.name === 'NotFoundException' || 
          error.name === 'ForbiddenException' ||
          error.name === 'ConflictException' ||
          error.name === 'UnprocessableEntityException') {
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
   * Get assessments for a specific subject (for trainers)
   */
  async getSubjectAssessments(
    query: GetSubjectAssessmentsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetSubjectAssessmentsResType> {
    try {
      const result = await this.assessmentRepo.getSubjectAssessments(
        query.subjectId,
        currentUser.userId,
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

      throw new Error('Failed to get subject assessments')
    }
  }

  /**
   * Get assessments for a specific course (for trainers)
   */
  async getCourseAssessments(
    query: GetCourseAssessmentsQueryType,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ): Promise<GetCourseAssessmentsResType> {
    try {
      const result = await this.assessmentRepo.getCourseAssessments(
        query.courseId,
        currentUser.userId,
        query.page,
        query.limit,
        query.status,
        query.search
      )

      return result
    } catch (error) {
      console.error('Get course assessments failed:', error)
      
      if (error.message === 'Trainer is not assigned to any subjects in this course') {
        throw new ForbiddenException('You are not assigned to any subjects in this course')
      }
      
      if (error.message === 'Course not found') {
        throw CourseNotFoundException
      }

      throw new Error('Failed to get course assessments')
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

    return traineeIds.map(id => {
      const trainee = trainees.find(t => t.id === id)
      return {
        id,
        exists: !!trainee,
        role: trainee?.role.name || null,
        isActive: trainee?.status === 'ACTIVE',
        isEnrolled: trainee?.subjectEnrollments.some(e => e.status === 'ENROLLED') || false
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
      const result = await this.assessmentRepo.getAssessmentSections(
        assessmentId,
        currentUser.userId
      )

      return result
    } catch (error) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || 
          error instanceof NotFoundException) {
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
   * Get all fields of an assessment section with their template field information and assessment values
   */
  async getAssessmentSectionFields(
    assessmentSectionId: string,
    currentUser: { userId: string; roleName: string; departmentId?: string }
  ) {
    try {
      // Get the assessment section fields with basic info
      const result = await this.assessmentRepo.getAssessmentSectionFields(assessmentSectionId)

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
        }
      } else if (templateSection.editBy === 'TRAINEE') {
        // Section requires trainee access - trainee can only access their own assessment
        canAccess = currentUser.roleName === 'TRAINEE' && assessment?.traineeId === currentUser.userId
      }

      if (!canAccess) {
        throw new ForbiddenException('You do not have permission to access this assessment section')
      }

      return result
    } catch (error) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || 
          error instanceof NotFoundException) {
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
      const sectionFields = await this.assessmentRepo.getAssessmentSectionFields(body.assessmentSectionId)
      
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
      const sectionValueIds = sectionFields.fields.map(field => field.assessmentValue.id)
      const providedValueIds = body.values.map(v => v.assessmentValueId)
      
      const invalidIds = providedValueIds.filter(id => !sectionValueIds.includes(id))
      if (invalidIds.length > 0) {
        throw new BadRequestException(`Invalid assessment value IDs: ${invalidIds.join(', ')}`)
      }

      // Save the values
      return await this.assessmentRepo.saveAssessmentValues(
        body.assessmentSectionId,
        body.values,
        userContext.userId
      )

    } catch (error: any) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || 
          error instanceof NotFoundException ||
          error instanceof BadRequestException) {
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

      return await this.assessmentRepo.toggleTraineeLock(
        assessmentId,
        body.isTraineeLocked,
        userContext.userId
      )

    } catch (error: any) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || 
          error instanceof NotFoundException) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle custom application errors from repository
      if (error.message.includes('occurrence date') || 
          error.message.includes('trainee sections')) {
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

      return await this.assessmentRepo.submitAssessment(
        assessmentId,
        userContext.userId
      )

    } catch (error: any) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || 
          error instanceof NotFoundException) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle custom application errors from repository
      if (error.message.includes('not ready to submit') || 
          error.message.includes('must be completed') ||
          error.message.includes('submittable section')) {
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
      const sectionFields = await this.assessmentRepo.getAssessmentSectionFields(body.assessmentSectionId)
      
      // Validate that all provided assessment value IDs belong to this section
      const sectionValueIds = sectionFields.fields.map(field => field.assessmentValue.id)
      const providedValueIds = body.values.map((v: any) => v.assessmentValueId)
      
      const invalidIds = providedValueIds.filter((id: any) => !sectionValueIds.includes(id))
      if (invalidIds.length > 0) {
        throw new BadRequestException(`Invalid assessment value IDs: ${invalidIds.join(', ')}`)
      }

      // Update the values (repository will check if user is the original assessor)
      return await this.assessmentRepo.updateAssessmentValues(
        body.assessmentSectionId,
        body.values,
        userContext.userId
      )

    } catch (error: any) {
      // Handle specific known errors
      if (error instanceof ForbiddenException || 
          error instanceof NotFoundException ||
          error instanceof BadRequestException) {
        throw error // Re-throw HTTP exceptions as-is
      }

      // Handle custom application errors from repository
      if (error.message.includes('originally assessed') || 
          error.message.includes('DRAFT status')) {
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
}
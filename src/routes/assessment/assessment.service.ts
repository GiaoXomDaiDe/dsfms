import { Injectable } from '@nestjs/common'
import { CourseStatus, SubjectStatus } from '@prisma/client'
import { AssessmentRepo } from './assessment.repo'
import {
  CreateAssessmentBodyType,
  CreateBulkAssessmentBodyType,
  CreateAssessmentResType,
  CreateBulkAssessmentResType,
  GetAssessmentsQueryType,
  GetAssessmentsResType,
  GetAssessmentDetailResType
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
  AllTraineesExcludedException
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

      // Step 4: Validate occurrence date is within subject/course date range
      const occurrenceDate = new Date(data.occuranceDate)
      
      // Debug logging to check date values
      console.log('Date validation check:')
      console.log('- Occurrence Date:', occurrenceDate.toISOString(), '(parsed from:', data.occuranceDate, ')')
      console.log('- Start Date:', startDate.toISOString())
      console.log('- End Date:', endDate.toISOString())
      console.log('- Is occurrence < start?', occurrenceDate < startDate)
      console.log('- Is occurrence > end?', occurrenceDate > endDate)
      
      if (occurrenceDate < startDate) {
        throw OccurrenceDateBeforeStartException(startDate, data.subjectId ? 'subject' : 'course')
      }
      if (occurrenceDate > endDate) {
        throw OccurrenceDateAfterEndException(endDate, data.subjectId ? 'subject' : 'course')
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

      // Step 7: Check for duplicate assessments
      const duplicateAssessments = await this.assessmentRepo.checkDuplicateAssessments(
        data.traineeIds,
        data.templateId,
        occurrenceDate,
        data.subjectId,
        data.courseId
      )

      if (duplicateAssessments.length > 0) {
        throw AssessmentAlreadyExistsException(duplicateAssessments)
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

      // Step 6: Validate occurrence date is within subject/course date range
      const occurrenceDate = new Date(data.occuranceDate)
      
      // Debug logging to check date values
      console.log('Bulk Assessment Date validation check:')
      console.log('- Occurrence Date:', occurrenceDate.toISOString(), '(parsed from:', data.occuranceDate, ')')
      console.log('- Start Date:', startDate.toISOString())
      console.log('- End Date:', endDate.toISOString())
      console.log('- Is occurrence < start?', occurrenceDate < startDate)
      console.log('- Is occurrence > end?', occurrenceDate > endDate)
      
      if (occurrenceDate < startDate) {
        throw OccurrenceDateBeforeStartException(startDate, data.subjectId ? 'subject' : 'course')
      }
      if (occurrenceDate > endDate) {
        throw OccurrenceDateAfterEndException(endDate, data.subjectId ? 'subject' : 'course')
      }

      // Step 7: Check for existing assessments and filter out duplicates
      const traineeIds = eligibleTrainees.map(t => t.id)
      const duplicateAssessments = await this.assessmentRepo.checkDuplicateAssessments(
        traineeIds,
        data.templateId,
        occurrenceDate,
        data.subjectId,
        data.courseId
      )

      // Filter out trainees who already have assessments
      const duplicateTraineeIds = duplicateAssessments.map(d => d.traineeId)
      const finalTraineeIds = traineeIds.filter(id => !duplicateTraineeIds.includes(id))
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
        // Duplicate assessments
        ...duplicateAssessments.map(d => ({
          traineeId: d.traineeId,
          traineeName: d.traineeName,
          reason: 'Assessment already exists for this template and date'
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
}
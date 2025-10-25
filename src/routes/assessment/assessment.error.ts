import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  ConflictException
} from '@nestjs/common'

// ===== TEMPLATE RELATED ERRORS =====

export const TemplateNotFoundException = new NotFoundException('Template not found')

export const TemplateNotActiveException = new BadRequestException('Template is not active')

export const TemplateDepartmentMismatchException = new ForbiddenException(
  'Template does not belong to the same department as the subject/course'
)

// ===== SUBJECT/COURSE VALIDATION ERRORS =====

export const SubjectOrCourseRequiredException = new BadRequestException([
  {
    message: 'Either subjectId or courseId must be provided',
    path: 'subjectId'
  },
  {
    message: 'Either subjectId or courseId must be provided',
    path: 'courseId'
  }
])

export const BothSubjectAndCourseProvidedException = new BadRequestException([
  {
    message: 'Cannot provide both subjectId and courseId, only one is allowed',
    path: 'subjectId'
  },
  {
    message: 'Cannot provide both subjectId and courseId, only one is allowed',
    path: 'courseId'
  }
])

export const SubjectNotFoundException = new NotFoundException('Subject not found')

export const CourseNotFoundException = new NotFoundException('Course not found')

export const SubjectNotActiveException = new BadRequestException('Subject is not active or has been deleted')

export const CourseNotActiveException = new BadRequestException('Course is not active or has been deleted')

// ===== DATE VALIDATION ERRORS =====

export const InvalidOccurrenceDateException = new BadRequestException([
  {
    message: 'Occurrence date must be within the subject/course date range',
    path: 'occuranceDate'
  }
])

export const OccurrenceDateBeforeStartException = (startDate: Date, entityType: 'subject' | 'course') =>
  new BadRequestException([
    {
      message: `Occurrence date cannot be before ${entityType} start date (${startDate.toISOString().split('T')[0]})`,
      path: 'occuranceDate'
    }
  ])

export const OccurrenceDateAfterEndException = (endDate: Date, entityType: 'subject' | 'course') =>
  new BadRequestException([
    {
      message: `Occurrence date cannot be after ${entityType} end date (${endDate.toISOString().split('T')[0]})`,
      path: 'occuranceDate'
    }
  ])

export const OccurrenceDateInPastException = new BadRequestException([
  {
    message: 'Occurrence date cannot be in the past',
    path: 'occuranceDate'
  }
])

// ===== TRAINEE VALIDATION ERRORS =====

export const TraineeNotFoundException = (traineeIds: string[]) =>
  new NotFoundException({
    message: 'One or more trainees not found',
    traineeIds
  })

export const TraineeNotActiveException = (traineeIds: string[]) =>
  new BadRequestException({
    message: 'One or more trainees are not active',
    traineeIds
  })

export const TraineeNotEnrolledException = (traineeIds: string[], entityType: 'subject' | 'course') =>
  new BadRequestException({
    message: `One or more trainees are not enrolled in the ${entityType}`,
    traineeIds,
    entityType
  })

export const TraineeInvalidRoleException = (traineeIds: string[]) =>
  new BadRequestException({
    message: 'One or more users do not have TRAINEE role',
    traineeIds
  })

export const NoTraineesProvidedException = new BadRequestException([
  {
    message: 'At least one trainee must be specified',
    path: 'traineeIds'
  }
])

export const NoEnrolledTraineesFoundException = (entityType: 'subject' | 'course', entityName: string) =>
  new BadRequestException({
    message: `No enrolled trainees found in the ${entityType}: ${entityName}`,
    entityType,
    entityName
  })

export const AllTraineesExcludedException = (totalEnrolled: number) =>
  new BadRequestException({
    message: `All ${totalEnrolled} enrolled trainees were excluded from assessment creation`,
    totalEnrolled
  })

// ===== DUPLICATE ASSESSMENT ERRORS =====

export const AssessmentAlreadyExistsException = (duplicates: Array<{traineeId: string, traineeName: string}>) =>
  new ConflictException({
    message: 'Assessment already exists for one or more trainees on the specified date',
    duplicates
  })

// ===== PERMISSION ERRORS =====

export const InsufficientPermissionException = new ForbiddenException(
  'Insufficient permissions to create assessments for this subject/course'
)

export const DepartmentAccessDeniedException = new ForbiddenException(
  'Access denied: You can only create assessments for your own department'
)

export const TrainerNotAssignedException = new ForbiddenException(
  'Trainers can only create assessments for subjects they are assigned to'
)

// ===== ASSESSMENT FORM ERRORS =====

export const AssessmentNotFoundException = new NotFoundException('Assessment not found')

export const AssessmentNotAccessibleException = new ForbiddenException(
  'You do not have permission to access this assessment'
)

export const AssessmentFormCreationFailedException = new BadRequestException(
  'Failed to create assessment form. Please try again.'
)

export const AssessmentSectionCreationFailedException = new BadRequestException(
  'Failed to create assessment sections. Please try again.'
)

export const AssessmentValueCreationFailedException = new BadRequestException(
  'Failed to create assessment values. Please try again.'
)

// ===== TEMPLATE STRUCTURE ERRORS =====

export const TemplateSectionNotFoundException = new NotFoundException(
  'One or more template sections not found for the specified template'
)

export const TemplateFieldNotFoundException = new NotFoundException(
  'One or more template fields not found for the template sections'
)

export const TemplateStructureCorruptedException = new BadRequestException(
  'Template structure is corrupted or incomplete. Please verify the template.'
)

// ===== BUSINESS LOGIC ERRORS =====

export const MaxAssessmentsPerDayExceededException = (maxAllowed: number) =>
  new BadRequestException([
    {
      message: `Maximum ${maxAllowed} assessments per day per trainee exceeded`,
      path: 'occuranceDate'
    }
  ])

export const AssessmentNameTooLongException = new BadRequestException([
  {
    message: 'Assessment name must not exceed 255 characters',
    path: 'name'
  }
])

export const InvalidAssessmentNameException = new BadRequestException([
  {
    message: 'Assessment name cannot be empty or contain only whitespace',
    path: 'name'
  }
])

// ===== SYSTEM ERRORS =====

export const DatabaseTransactionFailedException = new BadRequestException(
  'Database transaction failed. Assessment creation was rolled back.'
)

export const ConcurrentModificationException = new ConflictException(
  'The resource was modified by another user. Please refresh and try again.'
)

// ===== VALIDATION HELPER ERRORS =====

export const InvalidUUIDFormatException = (fieldName: string) =>
  new BadRequestException([
    {
      message: 'Invalid UUID format',
      path: fieldName
    }
  ])

export const RequiredFieldMissingException = (fieldName: string) =>
  new BadRequestException([
    {
      message: 'This field is required',
      path: fieldName
    }
  ])
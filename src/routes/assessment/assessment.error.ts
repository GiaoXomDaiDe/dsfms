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

export const TemplateNotPublishedException = new BadRequestException(
  'Only PUBLISHED templates can be used to create assessments'
)

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

export const SubjectNotActiveException = new BadRequestException('Subject is archived or has been deleted')

export const CourseNotActiveException = new BadRequestException('Course is archived or has been deleted')

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

export const AssessmentAlreadyExistsException = (duplicates: Array<{ traineeId: string; traineeName: string }>) =>
  new ConflictException({
    message: 'Assessment already exists for one or more trainees on the specified date',
    duplicates
  })

export const TraineeAssessmentExistsException = (
  duplicates: Array<{ traineeId: string; traineeName: string; assessmentId: string }>,
  entityType: 'subject' | 'course'
) =>
  new ConflictException({
    message: `Assessment form already exists for one or more trainees with the same template and occurrence date. Duplicate assessments are not allowed.`,
    duplicates,
    entityType
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

// ===== REPOSITORY SPECIFIC ERRORS =====

export const AssessmentSectionNotFoundError = new Error('Assessment section not found')

export const OriginalAssessorOnlyError = new Error(
  'Only the user who originally assessed this section can update the values'
)

export const SectionDraftStatusOnlyError = new Error('Can only update values for sections in DRAFT status')

export const AssessmentStatusNotAllowedError = new Error('Cannot update values for assessment in this status')

export const TrainerNotAssignedToSubjectError = new Error('Trainer is not assigned to this subject')

export const TrainerNotAssignedToCourseError = new Error('Trainer is not assigned to this course')

export const TraineeNoAssessmentsInSubjectError = new Error('Trainee has no assessments in this subject')

export const TraineeNoAssessmentsInCourseError = new Error('Trainee has no assessments in course')

export const SubjectNotFoundError = new Error('Subject not found')

export const CourseNotFoundError = new Error('Course not found')

export const AccessDeniedError = new Error('Access denied')

export const AssessmentNotReadyToSubmitError = new Error('Assessment is not ready to submit')

export const SubmittableSectionNotCompletedError = new Error(
  'All submittable sections must be completed before submission'
)

export const OccurrenceDateNotTodayError = new Error('Trainee lock can only be toggled on the occurrence date')

export const TraineeSectionsNotFoundError = new Error('No trainee sections found for this assessment')

// ===== SERVICE SPECIFIC ERRORS =====

export const GetSubjectAssessmentsFailedError = new Error('Failed to get subject assessments')

export const GetCourseAssessmentsFailedError = new Error('Failed to get course assessments')

export const GetAssessmentSectionsFailedError = new Error('Failed to get assessment sections')

export const GetAssessmentSectionFieldsFailedError = new Error('Failed to get assessment section fields')

export const SaveAssessmentValuesFailedError = new Error('Failed to save assessment values')

export const UpdateAssessmentValuesFailedError = new Error('Failed to update assessment values')

export const ToggleTraineeLockFailedError = new Error('Failed to toggle trainee lock')

export const SubmitAssessmentFailedError = new Error('Failed to submit assessment')

export const ConfirmAssessmentParticipationFailedError = new Error('Failed to confirm assessment participation')

// ===== PARTICIPATION CONFIRMATION ERRORS =====

export const OnlyTraineeCanConfirmParticipationError = new ForbiddenException(
  'Only trainees can confirm assessment participation'
)

export const TraineeNotAssignedToAssessmentError = new ForbiddenException(
  'You can only confirm participation for your own assessments'
)

export const AssessmentNotInSignaturePendingError = new BadRequestException(
  'Assessment must be in SIGNATURE_PENDING status to confirm participation'
)

// ===== SECTION PERMISSION ERRORS =====

export const SectionNotAccessibleError = new ForbiddenException('You do not have permission to access this section')

export const SectionEditNotAllowedError = new ForbiddenException('You do not have permission to edit this section')

// ===== VALIDATION ERRORS =====

export const InvalidAssessmentValueIdsError = (invalidIds: string[]) =>
  new BadRequestException(`Invalid assessment value IDs: ${invalidIds.join(', ')}`)

// ===== ASSESSMENT STATUS ERRORS =====

export const AssessmentNotInDraftStatusError = new Error('Assessment section must be in DRAFT status for updates')

export const AssessmentFormStatusNotCompatibleError = new Error('Assessment form status does not allow section updates')

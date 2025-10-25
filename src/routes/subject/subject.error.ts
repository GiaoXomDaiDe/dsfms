import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

// Subject Not Found Errors
export const SubjectNotFoundException = new NotFoundException('Subject not found')
export const CourseNotFoundException = new NotFoundException('Course not found')

// Subject Validation Errors
export const SubjectCodeAlreadyExistsException = new BadRequestException('Subject code already exists')
export const SubjectDateOutsideCourseDateRangeException = new BadRequestException(
  'Subject start date and end date must be within the course date range'
)

// Permission Errors
export const OnlyAcademicDepartmentCanCreateSubjectsException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can create subjects'
)
export const OnlyAcademicDepartmentCanUpdateSubjectsException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can update subjects'
)
export const OnlyAcademicDepartmentCanDeleteSubjectsException = new ForbiddenException(
  'Only ACADEMIC_DEPARTMENT can delete subjects'
)
export const DepartmentHeadCanOnlyManageOwnDepartmentSubjectsException = new ForbiddenException(
  'Department heads can only manage subjects in courses of their own department'
)

// Instructor Management Errors
export const TrainerNotFoundException = new BadRequestException(
  'One or more trainers not found or do not have TRAINER role'
)
export const TrainerNotFoundAtIndexException = (index: number, trainerEid: string) =>
  new BadRequestException(`Trainer with EID '${trainerEid}' at index ${index} not found or does not have TRAINER role`)

export const DuplicateInstructorException = new BadRequestException(
  'One or more trainers are already instructors of this subject'
)

// Enrollment Management Errors
export const TraineeNotFoundException = new BadRequestException(
  'One or more trainees not found or do not have TRAINEE role'
)
export const TraineeNotFoundAtIndexException = (index: number, traineeEid: string) =>
  new BadRequestException(`Trainee with EID '${traineeEid}' at index ${index} not found or does not have TRAINEE role`)

export const DuplicateEnrollmentException = new BadRequestException(
  'One or more trainees are already enrolled in this subject'
)
export const EnrollmentNotFoundException = new BadRequestException('Trainee enrollment not found')

export const TrainerAssignmentNotFoundException = new NotFoundException('Trainer assignment not found')

export const CourseAtCapacityException = (current: number, max: number, attempting: number) =>
  new BadRequestException(`Course is at capacity. Current: ${current}, Max: ${max}, Attempting to add: ${attempting}`)

export const CannotEnrollInRecurrentSubjectException = (reason?: string) =>
  new BadRequestException(reason ?? 'Cannot enroll in recurrent subject')

export const DuplicateTraineeEnrollmentException = (
  duplicates: Array<{
    eid: string
    email: string
    batchCode: string
    enrolledAt: string
  }>
) =>
  new BadRequestException({
    message: 'Duplicate trainee enrollments detected',
    duplicates
  })

export const InvalidTraineeSubmissionException = (
  invalid: Array<{
    submittedId: string
    eid?: string
    email?: string
    reason: string
    note?: string
  }>
) =>
  new BadRequestException({
    message: 'Invalid trainee submissions',
    invalid
  })

export const CannotCancelSubjectEnrollmentException = new BadRequestException(
  'Cannot cancel enrollment. Either it does not exist, batch code mismatch, or status is not ENROLLED.'
)

export const TraineeResolutionFailureException = (traineeId: string) =>
  new BadRequestException(`Unable to resolve trainee user ${traineeId}`)

// Hard Delete Prevention Errors
export const CannotHardDeleteSubjectWithEnrollmentsException = new BadRequestException(
  'Cannot permanently delete subject with existing enrollments'
)
export const CannotHardDeleteSubjectWithInstructorsException = new BadRequestException(
  'Cannot permanently delete subject with existing instructors'
)

// Bulk Operation Errors
export const BulkSubjectCodeAlreadyExistsAtIndexException = (index: number, code: string) =>
  `Subject code '${code}' at index ${index} already exists`

export const BulkInvalidDateRangeAtIndexException = (index: number) =>
  `Invalid date range at index ${index}: end date must be after start date`

export const BulkSubjectCreationFailedException = (index: number, error: string) =>
  `Failed to create subject at index ${index}: ${error}`

// Default Error Messages
export const DefaultSubjectValidationException = new BadRequestException('Subject validation failed')
export const DefaultSubjectCreationException = new BadRequestException('Failed to create subject')
export const DefaultSubjectUpdateException = new BadRequestException('Failed to update subject')
export const DefaultSubjectDeletionException = new BadRequestException('Failed to delete subject')

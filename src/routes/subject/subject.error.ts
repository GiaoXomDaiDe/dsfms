import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

// Subject Not Found Errors
export const SubjectNotFoundException = new NotFoundException('Subject not found')
export const CourseNotFoundException = new NotFoundException('Course not found')

// Subject Validation Errors
export const SubjectCodeAlreadyExistsException = new BadRequestException('Subject code already exists')
export const InvalidDateRangeException = new BadRequestException('End date must be after start date')
export const SubjectIsNotDeletedException = new BadRequestException('Subject is not deleted')

// Permission Errors
export const OnlyAdminAndDepartmentHeadCanCreateSubjectsException = new ForbiddenException(
  'Only administrators and department heads can create subjects'
)
export const OnlyAdminAndDepartmentHeadCanUpdateSubjectsException = new ForbiddenException(
  'Only administrators and department heads can update subjects'
)
export const OnlyAdminAndDepartmentHeadCanDeleteSubjectsException = new ForbiddenException(
  'Only administrators and department heads can delete subjects'
)
export const OnlyAdminAndDepartmentHeadCanRestoreSubjectsException = new ForbiddenException(
  'Only administrators and department heads can restore subjects'
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

// Hard Delete Prevention Errors
export const CannotHardDeleteSubjectWithEnrollmentsException = new BadRequestException(
  'Cannot permanently delete subject with existing enrollments'
)
export const CannotHardDeleteSubjectWithInstructorsException = new BadRequestException(
  'Cannot permanently delete subject with existing instructors'
)

// Restore Errors
export const CannotRestoreSubjectCodeConflictException = new BadRequestException(
  'Cannot restore subject: code conflicts with existing active subject'
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

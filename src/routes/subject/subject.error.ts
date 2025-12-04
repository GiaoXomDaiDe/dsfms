import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

// Subject Not Found Errors
export const SubjectNotFoundException = new NotFoundException('Subject not found')
export const CourseNotFoundException = new NotFoundException('Course not found')

// Subject Validation Errors
export const SubjectCodeAlreadyExistsException = new BadRequestException('Subject code already exists in this course')
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

export const DuplicateTraineeEnrollmentException = ({
  duplicates,
  subjectName,
  subjectCode
}: {
  duplicates: Array<{
    eid: string
    fullName: string
    email: string
    batchCode: string
    enrolledAt: string
  }>
  subjectName: string
  subjectCode: string
}) => {
  const traineeNames = duplicates.map((d) => `${d.fullName} (${d.eid})`).join(', ')

  return new BadRequestException({
    message: `The following trainee(s) have already been enrolled in subject "${subjectName}" (${subjectCode}): ${traineeNames}`,
    duplicates,
    subject: {
      name: subjectName,
      code: subjectCode
    }
  })
}

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
export const CannotArchiveSubjectWithActiveEnrollmentsException = new BadRequestException(
  'Cannot archive subject while it still has active enrollments'
)
export const CannotArchiveSubjectWithNonCancelledEnrollmentsException = new BadRequestException(
  'Cannot archive subject unless all enrollments are cancelled'
)
export const SubjectAlreadyArchivedException = new BadRequestException('Subject is already archived')
export const SubjectCannotBeArchivedFromCurrentStatusException = new BadRequestException(
  'Subject can only be archived when status is PLANNED or ON_GOING'
)
export const SubjectCannotAssignTrainerFromCurrentStatusException = new BadRequestException(
  'Subject can only assign trainers when status is PLANNED or ON_GOING'
)
export const SubjectCannotUpdateTrainerAssignmentFromCurrentStatusException = new BadRequestException(
  'Subject can only update trainer assignments when status is PLANNED or ON_GOING'
)
export const SubjectCannotRemoveTrainerFromCurrentStatusException = new BadRequestException(
  'Subject can only remove trainers when status is PLANNED or ON_GOING'
)
export const SubjectEnrollmentWindowClosedException = (startDate: Date | string) =>
  new BadRequestException(`Cannot enroll trainees after subject start date ${new Date(startDate).toISOString()}`)

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
  new BadRequestException(`Subject code '${code}' at index ${index} already exists in this course`)

export const BulkInvalidDateRangeAtIndexException = (index: number) =>
  new BadRequestException(`Invalid date range at index ${index}: end date must be after start date`)

export const BulkSubjectCreationFailedException = (index: number, error: string) =>
  new BadRequestException(`Failed to create subject at index ${index}: ${error}`)

// Default Error Messages
export const DefaultSubjectValidationException = new BadRequestException('Subject validation failed')
export const DefaultSubjectCreationException = new BadRequestException('Failed to create subject')
export const DefaultSubjectUpdateException = new BadRequestException('Failed to update subject')
export const DefaultSubjectDeletionException = new BadRequestException('Failed to delete subject')

export const SubjectDatesOutsideCourseRangeException = ({
  courseId,
  courseStart,
  courseEnd,
  subjectStart,
  subjectEnd
}: {
  courseId: string
  courseStart: Date
  courseEnd: Date
  subjectStart: Date
  subjectEnd: Date
}) =>
  new BadRequestException({
    message: 'Subject dates must stay within the course date range',
    course: {
      id: courseId,
      startDate: courseStart,
      endDate: courseEnd
    },
    subject: {
      startDate: subjectStart,
      endDate: subjectEnd
    }
  })

import { BadRequestException } from '@nestjs/common'

const COURSE_ERROR_CONTEXT = 'COURSE'
const DEPARTMENT_ERROR_CONTEXT = 'DEPARTMENT'

type ErrorPayload = {
  message: string
  errorCode: string
} & Record<string, unknown>

const courseError = (payload: ErrorPayload) =>
  new BadRequestException({
    context: COURSE_ERROR_CONTEXT,
    ...payload
  })

const departmentError = (payload: ErrorPayload) =>
  new BadRequestException({
    context: DEPARTMENT_ERROR_CONTEXT,
    ...payload
  })

// Validation & existence errors
export const CourseNotFoundException = courseError({
  message: 'Course not found',
  errorCode: 'COURSE_NOT_FOUND'
})

export const CourseCodeAlreadyExistsException = courseError({
  message: 'Course code already exists in this department',
  errorCode: 'COURSE_CODE_ALREADY_EXISTS',
  field: 'code'
})

export const DepartmentNotFoundException = departmentError({
  message: 'Department not found',
  errorCode: 'DEPARTMENT_NOT_FOUND'
})

// Archive constraints
export const CannotArchiveCourseWithActiveSubjectsException = courseError({
  message: 'Cannot archive course while it still has active subjects',
  errorCode: 'COURSE_ARCHIVE_ACTIVE_SUBJECTS'
})

export const CannotArchiveCourseWithNonCancelledEnrollmentsException = courseError({
  message: 'Cannot archive course unless all enrollments are cancelled',
  errorCode: 'COURSE_ARCHIVE_PENDING_ENROLLMENTS'
})

export const CourseCannotBeArchivedFromCurrentStatusException = courseError({
  message: 'Course can only be archived when status is PLANNED or ON_GOING',
  errorCode: 'COURSE_ARCHIVE_STATUS_INVALID',
  allowedStatuses: ['PLANNED', 'ON_GOING']
})

// Trainer assignment constraints
export const CourseCannotAssignTrainerFromCurrentStatusException = courseError({
  message: 'Trainer can only be assigned when course status is PLANNED or ON_GOING',
  errorCode: 'COURSE_ASSIGN_TRAINER_STATUS_INVALID',
  allowedStatuses: ['PLANNED', 'ON_GOING']
})

export const CourseCannotUpdateTrainerRoleFromCurrentStatusException = courseError({
  message: 'Trainer role can only be updated when course status is PLANNED or ON_GOING',
  errorCode: 'COURSE_UPDATE_TRAINER_STATUS_INVALID',
  allowedStatuses: ['PLANNED', 'ON_GOING']
})

export const CourseTrainerAlreadyAssignedException = courseError({
  message: 'Trainer is already assigned to this course',
  errorCode: 'COURSE_TRAINER_ALREADY_ASSIGNED'
})

export const CourseTrainerAssignmentNotFoundException = courseError({
  message: 'Trainer assignment for this course not found',
  errorCode: 'COURSE_TRAINER_ASSIGNMENT_NOT_FOUND'
})

// Date validations
export const CourseDateRangeViolationException = (
  violations: Array<{
    subjectId: string
    subjectName: string
    subjectStart: Date
    subjectEnd: Date
  }>
) =>
  courseError({
    message: 'Course date range cannot exclude existing subjects',
    errorCode: 'COURSE_DATE_RANGE_VIOLATION',
    subjects: violations.map((item) => ({
      id: item.subjectId,
      name: item.subjectName,
      startDate: item.subjectStart,
      endDate: item.subjectEnd
    }))
  })

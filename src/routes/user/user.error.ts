import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { ValidationException } from '~/shared/exceptions/validation.exception'

export const UserNotFoundException = new NotFoundException({
  message: 'User not found',
  error: 'USER_NOT_FOUND'
})

export const UserAlreadyExistsException = new ValidationException([
  {
    message: 'User already exists',
    path: 'email'
  }
])

export const UserIsNotDisabledException = new BadRequestException('User is not disabled')

export const TrainerAssignedToOngoingSubjectException = (subjects: Array<{ id: string; code: string; name: string }>) =>
  new BadRequestException({
    message: 'Cannot disable trainer while assigned to ongoing subjects',
    subjects: subjects.map((subject) => ({
      id: subject.id,
      code: subject.code,
      name: subject.name
    }))
  })

export const CannotUpdateOrDeleteYourselfException = new ForbiddenException('Cannot update or delete yourself')

export const CannotDeleteAdminUserException = new ForbiddenException('Cannot delete admin user')

export const CannotUpdateAdminUserException = new ForbiddenException('Cannot update admin user')

export const CannotSetAdminRoleToUserException = new ForbiddenException('Cannot set admin role to user')

export const OnlyAdminCanManageAdminRoleException = new ForbiddenException(
  'Only ADMINISTRATOR can create, update, or delete users with ADMINISTRATOR role.'
)

export const RoleNotFoundException = new ValidationException([
  {
    message: 'Role not found',
    path: 'roleId'
  }
])

export const RoleIsDisabledException = new ForbiddenException('Cannot create user with disabled role')

export const DefaultRoleValidationException = new BadRequestException({
  message: 'Role validation failed',
  error: 'ROLE_VALIDATION_FAILED'
})

export const DepartmentNotFoundException = new ValidationException([
  {
    message: 'Department not found',
    path: 'departmentId'
  }
])

export const DepartmentIsDisabledException = new ForbiddenException('Cannot assign user to disabled department')

export const InvalidDepartmentAssignmentException = (roleName: string) =>
  new ForbiddenException(`Only TRAINER or DEPARTMENT_HEAD can be assigned to a department. Current role: ${roleName}`)

export const RequiredProfileMissingException = (roleName: string, requiredProfile: string) =>
  new ConflictException(`Role ${roleName} must have ${requiredProfile}. Please provide profile information.`)

export const ForbiddenProfileException = (roleName: string, forbiddenProfile: string, message: string) =>
  new ConflictException(`Role ${roleName} cannot have ${forbiddenProfile}. ${message}`)

export const TrainerProfileNotAllowedException = (roleName: string) =>
  new ConflictException(
    `Role ${roleName} cannot have trainerProfile. Only TRAINER role is allowed to have trainer profile.`
  )

export const TraineeProfileNotAllowedException = (roleName: string) =>
  new ConflictException(
    `Role ${roleName} cannot have traineeProfile. Only TRAINEE role is allowed to have trainee profile.`
  )

export const BulkDepartmentIsDisabledAtIndexException = (index: number, departmentName: string) =>
  `User at index ${index}: Cannot assign user to disabled department "${departmentName}"`

export const BulkDepartmentNotFoundAtIndexException = (index: number, departmentId: string) =>
  `User at index ${index}: Department with ID "${departmentId}" not found`

export const BulkForbiddenProfileException = (
  userIndex: number,
  roleName: string,
  forbiddenProfile: string,
  message: string
) => `User at index ${userIndex}: Role ${roleName} cannot have ${forbiddenProfile}. ${message}`

export const BulkInvalidDepartmentAssignmentException = (index: number, roleName: string) =>
  `User at index ${index}: Department assignment not allowed for ${roleName} role. Only TRAINER and DEPARTMENT_HEAD roles are allowed.`

export const BulkRoleIsDisabledAtIndexException = (index: number, roleName: string) =>
  `User at index ${index}: Cannot create user with disabled role "${roleName}"`

export const BulkRoleNotFoundAtIndexException = (index: number) => `Role not found for user at index ${index}`

export const BulkRequiredProfileMissingException = (
  userIndex: number,
  roleName: string,
  requiredProfile: string,
  message: string
) => `User at index ${userIndex}: Role ${roleName} must have ${requiredProfile}. ${message}`

export const BulkTrainerProfileNotAllowedException = (userIndex: number, roleName: string) =>
  `User at index ${userIndex}: Role ${roleName} cannot have trainerProfile. Only TRAINER role is allowed to have trainer profile.`

export const BulkTraineeProfileNotAllowedException = (userIndex: number, roleName: string) =>
  `User at index ${userIndex}: Role ${roleName} cannot have traineeProfile. Only TRAINEE role is allowed to have trainee profile.`

export const BulkEidCountMismatchException = (expected: number, actual: number) =>
  new ConflictException({
    message: `EID generation mismatch. Expected ${expected} but received ${actual}.`,
    error: 'BULK_EID_COUNT_MISMATCH',
    expected,
    actual
  })

export class BulkUserCreationException extends BadRequestException {
  constructor(message: string, details?: any) {
    super({
      message: message,
      error: 'BULK_CREATION_ERROR',
      details: details
    })
  }
}

export const BulkDuplicateDataFoundMessage = 'Duplicate data found'

export const BulkEmailAlreadyExistsMessage = (email: string) => `Email already exists: ${email}`

export const BulkUniqueConstraintEmailMessage = 'Unique constraint failed on the fields: (`email`)' as const

export const BulkUniqueConstraintMessage = 'Unique constraint failed'

export const BulkUnknownErrorMessage = 'Unknown error'

export const AtLeastOneUserRequiredMessage = 'At least one user is required'

export const MaximumUsersAllowedMessage = 'Maximum 100 users allowed per batch'

export const DuplicateEmailInBatchMessage = (email: string, index1: number, index2: number) =>
  `Duplicate email found: ${email} (users at index ${index1} and ${index2})`

export const InvalidRoleIdMessage = 'Invalid role ID'

export const InvalidRoleNameMessage = 'Invalid Role Name'

export const InvalidRoleNameUpdateMessage = 'Invalid role name'

export const ProfileNotAllowedForRoleMessage = (profile: string, roleName: string) =>
  `${profile} is not allowed for ${roleName} role`

export const DepartmentHeadAlreadyExistsException = (departmentName: string, existingHead: string, eid: string) =>
  new ValidationException(
    [
      {
        path: 'departmentHead',
        message: `Department "${departmentName}" already has a department head: ${existingHead} (${eid}). Each department can only have one department head.`
      }
    ],
    'Validation failed'
  )

export const BulkDepartmentHeadAlreadyExistsAtIndexException = (
  index: number,
  departmentName: string,
  existingHead: string,
  eid: string
) =>
  `User at index ${index}: Department "${departmentName}" already has a department head: ${existingHead} (${eid}). Each department can only have one department head.`

export const CannotChangeRoleOfActiveDepartmentHeadException = (departmentName: string, eid: string) =>
  new ForbiddenException(
    `Cannot change role of active department head (${eid}) for department "${departmentName}". Please assign a new department head first, then change this user's role.`
  )

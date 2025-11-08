import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common'

/* =========================
 * User Basic Operations - Lỗi cơ bản khi thao tác với User
 * Phục vụ: Validate các operation cơ bản như create, update, delete user
 * ========================= */

// Lỗi khi user không tồn tại - dùng trong findOne, update, delete
export const UserNotFoundException = new NotFoundException({
  message: 'User not found',
  error: 'USER_NOT_FOUND'
})

// Lỗi khi email đã tồn tại - dùng khi create user mới
export const UserAlreadyExistsException = new UnprocessableEntityException([
  {
    message: 'User already exists',
    path: 'email'
  }
])

// Lỗi khi user không bị disable - dùng khi enable user đã active
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

/* =========================
 * User Self-Operation Protection - Bảo vệ user tự thao tác trên chính mình
 * Phục vụ: Ngăn user tự update/delete chính mình để tránh mất quyền truy cập
 * ========================= */

// Lỗi khi user cố gắng update/delete chính mình
export const CannotUpdateOrDeleteYourselfException = new ForbiddenException('Cannot update or delete yourself')

/* =========================
 * Admin Protection Errors - Bảo vệ tài khoản Admin
 * Phục vụ: Bảo vệ admin user khỏi bị xóa/update bởi non-admin users
 * ========================= */

// Lỗi khi cố gắng xóa admin user - bảo vệ admin khỏi bị xóa
export const CannotDeleteAdminUserException = new ForbiddenException('Cannot delete admin user')

// Lỗi khi cố gắng update admin user - chỉ admin mới được update admin
export const CannotUpdateAdminUserException = new ForbiddenException('Cannot update admin user')

// Lỗi khi non-admin cố gắng set role admin cho user khác
export const CannotSetAdminRoleToUserException = new ForbiddenException('Cannot set admin role to user')

// Lỗi khi chỉ admin mới được quản lý admin role
export const OnlyAdminCanManageAdminRoleException = new ForbiddenException(
  'Only ADMINISTRATOR can create, update, or delete users with ADMINISTRATOR role.'
)

/* =========================
 * Role & Department Validation - Validate Role và Department khi tạo/update User
 * Phục vụ: Kiểm tra role và department có tồn tại và active không
 * ========================= */

// Lỗi khi role không tồn tại - validate roleId khi create/update user
export const RoleNotFoundException = new UnprocessableEntityException([
  {
    message: 'Role not found',
    path: 'roleId'
  }
])

// Lỗi khi role bị disable - không cho phép assign disabled role
export const RoleIsDisabledException = new ForbiddenException('Cannot create user with disabled role')

// Lỗi general khi validate role - fallback error
export const DefaultRoleValidationException = new BadRequestException({
  message: 'Role validation failed',
  error: 'ROLE_VALIDATION_FAILED'
})

// Lỗi khi department không tồn tại - validate departmentId
export const DepartmentNotFoundException = new UnprocessableEntityException([
  {
    message: 'Department not found',
    path: 'departmentId'
  }
])

// Lỗi khi department bị disable - không cho phép assign user vào disabled department
export const DepartmentIsDisabledException = new ForbiddenException('Cannot assign user to disabled department')

/* =========================
 * Role-Department Business Rules - Quy tắc nghiệp vụ giữa Role và Department
 * Phục vụ: Enforce business rules về việc role nào được assign department
 * ========================= */

// Lỗi khi role không được phép có department - chỉ TRAINER và DEPARTMENT_HEAD được assign department
export const InvalidDepartmentAssignmentException = (roleName: string) =>
  new ForbiddenException(`Only TRAINER or DEPARTMENT_HEAD can be assigned to a department. Current role: ${roleName}`)

/* =========================
 * Profile Validation - Validate Profile theo Role
 * Phục vụ: Enforce business rules về profile theo từng role
 * ========================= */

// Lỗi khi role yêu cầu profile nhưng không có - TRAINER cần trainerProfile, TRAINEE cần traineeProfile
export const RequiredProfileMissingException = (roleName: string, requiredProfile: string) =>
  new ConflictException(`Role ${roleName} must have ${requiredProfile}. Please provide profile information.`)

// Lỗi general khi role không được phép có profile
export const ForbiddenProfileException = (roleName: string, forbiddenProfile: string, message: string) =>
  new ConflictException(`Role ${roleName} cannot have ${forbiddenProfile}. ${message}`)

// Lỗi khi non-TRAINER role có trainerProfile
export const TrainerProfileNotAllowedException = (roleName: string) =>
  new ConflictException(
    `Role ${roleName} cannot have trainerProfile. Only TRAINER role is allowed to have trainer profile.`
  )

// Lỗi khi non-TRAINEE role có traineeProfile
export const TraineeProfileNotAllowedException = (roleName: string) =>
  new ConflictException(
    `Role ${roleName} cannot have traineeProfile. Only TRAINEE role is allowed to have trainee profile.`
  )

/* =========================
 * Bulk Operation Exceptions - Lỗi khi thao tác hàng loạt (Bulk Create)
 * Phục vụ: Tạo error messages cho từng user trong batch khi bulk create
 * ========================= */

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

/* =========================
 * Bulk Error Exception Class - Class exception cho bulk operations
 * Phục vụ: Throw error với details khi bulk create user thất bại
 * ========================= */

export class BulkUserCreationException extends BadRequestException {
  constructor(message: string, details?: any) {
    super({
      message: message,
      error: 'BULK_CREATION_ERROR',
      details: details
    })
  }
}

/* =========================
 * Bulk Error Messages - Messages cho bulk operation errors
 * Phục vụ: Cung cấp messages chuẩn cho các lỗi bulk operation
 * ========================= */

// Message khi có duplicate data trong batch
export const BulkDuplicateDataFoundMessage = 'Duplicate data found'

// Message khi email đã tồn tại trong database
export const BulkEmailAlreadyExistsMessage = (email: string) => `Email already exists: ${email}`

// Message cho unique constraint violation trên email field
export const BulkUniqueConstraintEmailMessage = 'Unique constraint failed on the fields: (`email`)'

// Message general cho unique constraint errors
export const BulkUniqueConstraintMessage = 'Unique constraint failed'

// Message cho unknown errors trong bulk operations
export const BulkUnknownErrorMessage = 'Unknown error'

/* =========================
 * Validation Messages - Validation messages cho DTO validation
 * Phục vụ: Cung cấp error messages cho validation pipes và DTO
 * ========================= */

// Message yêu cầu ít nhất 1 user trong batch
export const AtLeastOneUserRequiredMessage = 'At least one user is required'

// Message giới hạn tối đa 100 users per batch
export const MaximumUsersAllowedMessage = 'Maximum 100 users allowed per batch'

// Message khi có duplicate email trong cùng 1 batch
export const DuplicateEmailInBatchMessage = (email: string, index1: number, index2: number) =>
  `Duplicate email found: ${email} (users at index ${index1} and ${index2})`

// Messages cho role validation
export const InvalidRoleIdMessage = 'Invalid role ID'
export const InvalidRoleNameMessage = 'Invalid Role Name'
export const InvalidRoleNameUpdateMessage = 'Invalid role name'

// Messages cho department assignment rules
export const DepartmentRequiredForDepartmentHeadMessage = 'Department ID is required for DEPARTMENT_HEAD role'
export const DepartmentRequiredForTrainerMessage = 'Department ID is required for TRAINER role'

export const DepartmentAssignmentNotAllowedMessage = (roleName: string) =>
  `Department assignment is not allowed for ${roleName} role. Only TRAINER and DEPARTMENT_HEAD roles can be assigned to a department.`

export const DepartmentNotAllowedForRoleMessage = (roleName: string) =>
  `Department ID is not allowed for ${roleName} role. Only TRAINER and DEPARTMENT_HEAD roles can be assigned to a department.`

// Message cho profile validation
export const ProfileNotAllowedForRoleMessage = (profile: string, roleName: string) =>
  `${profile} is not allowed for ${roleName} role`

/* =========================
 * Department Head Unique Constraint - Validation cho unique department head
 * Phục vụ: Enforce business rule: 1 department chỉ có 1 department head
 * ========================= */

// Lỗi khi department đã có department head
export const DepartmentHeadAlreadyExistsException = (departmentName: string, existingHead: string, eid: string) =>
  new UnprocessableEntityException(
    `Department "${departmentName}" already has a department head: ${existingHead} (${eid}). Each department can only have one department head.`
  )

// Message cho bulk create khi department đã có head
export const BulkDepartmentHeadAlreadyExistsAtIndexException = (
  index: number,
  departmentName: string,
  existingHead: string,
  eid: string
) =>
  `User at index ${index}: Department "${departmentName}" already has a department head: ${existingHead} (${eid}). Each department can only have one department head.`

// Lỗi khi department head không có departmentId
export const DepartmentHeadRequiresDepartmentException = new BadRequestException(
  'Department Head must be assigned to a department'
)

// Lỗi khi cố gắng đổi role của department head đang active
export const CannotChangeRoleOfActiveDepartmentHeadException = (departmentName: string, eid: string) =>
  new ForbiddenException(
    `Cannot change role of active department head (${eid}) for department "${departmentName}". Please assign a new department head first, then change this user's role.`
  )

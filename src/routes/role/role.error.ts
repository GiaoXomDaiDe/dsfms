import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { ValidationException } from '~/shared/exceptions/validation.exception'

/* =========================
 * Basic Role Exceptions - Lỗi cơ bản về role entity
 * ========================= */

// Lỗi khi không tìm thấy role
export const NotFoundRoleException = new NotFoundException('Role not found')

// Lỗi khi tạo role với tên đã tồn tại
export const RoleAlreadyExistsException = new ValidationException([
  {
    message: 'Role already exists',
    path: 'name'
  }
])

// Lỗi khi tên role đã tồn tại (conflict)
export const RoleNameAlreadyExistsException = new ConflictException({
  message: 'Role name already exists',
  errorCode: 'ROLE_NAME_ALREADY_EXISTS'
})

// Lỗi khi role không active và không thể assign cho user
export const RoleIsInactiveException = new BadRequestException({
  message: 'Role is inactive and cannot be assigned',
  errorCode: 'ROLE_IS_INACTIVE'
})

// Lỗi khi status role không hợp lệ
export const InvalidRoleStatusException = new BadRequestException({
  message: 'Invalid role status. Must be ACTIVE or INACTIVE',
  errorCode: 'INVALID_ROLE_STATUS'
})

/* =========================
 * Role Permission Exceptions - Lỗi liên quan đến permissions
 * ========================= */

// Lỗi khi role cần ít nhất một permission
export const AtLeastOnePermissionRequiredException = new BadRequestException({
  message: 'At least one permission is required',
  errorCode: 'AT_LEAST_ONE_PERMISSION_REQUIRED'
})

// Lỗi khi có permission IDs trùng lặp
export const DuplicatePermissionIdsException = new BadRequestException({
  message: 'Duplicate permission IDs are not allowed',
  errorCode: 'DUPLICATE_PERMISSION_IDS'
})

// Lỗi khi không tìm thấy permission cho role
export const PermissionNotFoundForRoleException = new NotFoundException({
  message: 'One or more permissions not found',
  errorCode: 'PERMISSION_NOT_FOUND_FOR_ROLE'
})

/* =========================
 * Role Deletion Exceptions - Lỗi khi xóa role
 * ========================= */

// Lỗi khi xóa role đang được assign cho users
export const CannotDeleteRoleWithUsersException = new ConflictException({
  message: 'Cannot delete role that is assigned to users',
  errorCode: 'CANNOT_DELETE_ROLE_WITH_USERS'
})

// Lỗi khi xóa system roles
export const CannotDeleteSystemRoleException = new ForbiddenException({
  message: 'Cannot delete system roles (ADMINISTRATOR, DEPARTMENT_HEAD, ACADEMIC_DEPARTMENT)',
  errorCode: 'CANNOT_DELETE_SYSTEM_ROLE'
})

// Lỗi khi thực hiện hành động bị cấm trên base role
export const ProhibitedActionOnBaseRoleException = new ForbiddenException('Prohibited action on base role')

/* =========================
 * Role Access Control Exceptions - Lỗi về quyền truy cập
 * ========================= */

// Lỗi khi chỉ admin mới được quản lý roles
export const OnlyAdminCanManageRolesException = new ForbiddenException({
  message: 'Only administrators can manage roles',
  errorCode: 'ONLY_ADMIN_CAN_MANAGE_ROLES'
})

// Lỗi khi cố gắng deactivate role của chính mình
export const CannotDeactivateOwnRoleException = new ConflictException({
  message: 'Cannot deactivate your own role',
  errorCode: 'CANNOT_DEACTIVATE_OWN_ROLE'
})

// Lỗi khi cố gắng modify system roles
export const CannotModifySystemRoleException = new ForbiddenException({
  message: 'Cannot modify system roles (ADMINISTRATOR, DEPARTMENT_HEAD, ACADEMIC_DEPARTMENT)',
  errorCode: 'CANNOT_MODIFY_SYSTEM_ROLE'
})

/* =========================
 * Dynamic Role Error Functions - Các hàm tạo lỗi động
 * ========================= */

/**
 * Lỗi khi cố gắng cập nhật fields không được phép cho system roles
 */
export function createSystemRoleUpdateRestrictedError(
  roleName: string,
  allowedFields: string[],
  restrictedFields: string[]
) {
  return new BadRequestException({
    message: `System role "${roleName}" can only update: ${allowedFields.join(', ')}`,
    errorCode: 'SYSTEM_ROLE_UPDATE_RESTRICTED',
    roleName,
    allowedFields,
    restrictedFields,
    suggestion: 'Remove restricted fields from your update request'
  })
}

/**
 * Lỗi khi cố gắng xóa system role
 */
export function createSystemRoleDeleteForbiddenError(roleName: string) {
  return new BadRequestException({
    message: `Cannot delete system role: ${roleName}`,
    errorCode: 'SYSTEM_ROLE_DELETE_FORBIDDEN',
    roleName,
    reason: 'System roles are protected from deletion to maintain application integrity'
  })
}

/**
 * Lỗi khi không có quyền admin để quản lý role
 */
export function createAdminRoleAccessDeniedError(roleName: string, currentRole: string) {
  return new BadRequestException({
    message: `Only administrators can manage ${roleName} role`,
    errorCode: 'ADMIN_ROLE_ACCESS_DENIED',
    requiredRole: 'ADMINISTRATOR',
    currentRole
  })
}

/**
 * Lỗi khi role đã active
 */
export function createRoleAlreadyActiveError(roleName: string) {
  return new BadRequestException({
    message: `Role "${roleName}" is already active`,
    errorCode: 'ROLE_ALREADY_ACTIVE',
    roleName
  })
}

/**
 * Lỗi khi không có quyền admin để thực hiện operation
 */
export function createRequireAdminPermissionError(operation: string) {
  return new ForbiddenException({
    message: `Only administrators can ${operation}`,
    errorCode: 'REQUIRE_ADMIN_PERMISSION',
    operation,
    requiredRole: 'ADMINISTRATOR'
  })
}

export function createPermissionGroupNotFoundError(permissionGroupCodes: string[]) {
  return new NotFoundException({
    message: `Permission group codes not found: ${permissionGroupCodes.join(', ')}`,
    errorCode: 'PERMISSION_GROUP_NOT_FOUND',
    permissionGroupCodes
  })
}

export function createPermissionGroupWithoutPermissionsError(permissionGroupCodes: string[]) {
  return new BadRequestException({
    message: `Permission groups lack endpoint permissions: ${permissionGroupCodes.join(', ')}`,
    errorCode: 'PERMISSION_GROUP_HAS_NO_PERMISSIONS',
    permissionGroupCodes
  })
}

/* =========================
 * System Error Exceptions - Lỗi hệ thống
 * ========================= */

// Lỗi khi admin cố gắng delete chính mình
export const AdminCannotDeleteSelfException = new BadRequestException({
  message: 'Administrator cannot delete their own role',
  errorCode: 'ADMIN_CANNOT_DELETE_SELF',
  reason: 'This would remove all administrative access from the system'
})

// Lỗi unexpected khi enable role
export const UnexpectedEnableErrorException = new BadRequestException({
  message: 'Unexpected unique constraint violation during role enable operation',
  errorCode: 'UNEXPECTED_ENABLE_ERROR',
  solution: 'Please contact system administrator if this persists'
})

// Lỗi khi tất cả permissions đã được assign cho role
export const NoNewPermissionsToAddException = new BadRequestException({
  message: 'All specified permissions are already assigned to this role',
  errorCode: 'NO_NEW_PERMISSIONS_TO_ADD',
  suggestion: 'Check current role permissions before adding new ones'
})

export const NoPermissionsToRemoveException = new BadRequestException({
  message: 'None of the specified permissions are currently assigned to this role',
  errorCode: 'NO_PERMISSIONS_TO_REMOVE',
  suggestion: 'Verify the permission list before removing'
})

/* =========================
 * Validation Error Messages - Messages cho schema validation
 * Phục vụ: Cung cấp consistent error messages cho Zod schema validation
 * ========================= */

// Message cho permission validation
export const AT_LEAST_ONE_PERMISSION_REQUIRED_MESSAGE = 'At least one permission ID is required'
export const PERMISSION_IDS_MUST_BE_UNIQUE_MESSAGE = 'Permission IDs must be unique'
export const PERMISSION_ID_MUST_BE_UUID_MESSAGE = 'Permission ID must be a valid UUID'
export const AT_LEAST_ONE_PERMISSION_GROUP_REQUIRED_MESSAGE = 'At least one permission group code is required'
export const PERMISSION_GROUP_CODES_MUST_BE_UNIQUE_MESSAGE = 'Permission group codes must be unique'

// Message cho role validation
export const ROLE_NAME_REQUIRED_MESSAGE = 'Role name is required'
export const ROLE_NAME_MAX_LENGTH_MESSAGE = 'Role name cannot exceed 500 characters'
export const ROLE_DESCRIPTION_MAX_LENGTH_MESSAGE = 'Role description cannot exceed 1000 characters'
export const INVALID_ROLE_STATUS_MESSAGE = 'Role status must be ACTIVE or INACTIVE'

import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'

/* =========================
 * Basic Permission Exceptions - Lỗi cơ bản về permission entity
 * Phục vụ: CRUD operations cơ bản cho permissions
 * ========================= */

// Lỗi khi không tìm thấy permission
export const NotFoundPermissionException = new NotFoundException({
  message: 'Permission not found',
  errorCode: 'PERMISSION_NOT_FOUND'
})

// Lỗi khi tạo permission với path+method đã tồn tại
export const PermissionAlreadyExistsException = new UnprocessableEntityException([
  {
    path: 'path',
    message: 'Permission path must be unique'
  },
  {
    path: 'method',
    message: 'Permission method must be unique'
  }
])

// Lỗi khi permission đã active
export const PermissionAlreadyActiveException = new BadRequestException({
  message: 'Permission is already active',
  errorCode: 'PERMISSION_ALREADY_ACTIVE'
})

// Lỗi khi permission không bị disable
export const PermissionNotDisabledException = new BadRequestException({
  message: 'Permission is not disabled',
  errorCode: 'PERMISSION_NOT_DISABLED'
})

/* =========================
 * Permission Business Rules - Quy tắc nghiệp vụ cho permissions
 * Phục vụ: Enforce business rules specific to permissions
 * ========================= */

// Lỗi khi cố gắng xóa system permission
export const CannotDeleteSystemPermissionException = new BadRequestException({
  message: 'Cannot delete system permissions',
  errorCode: 'CANNOT_DELETE_SYSTEM_PERMISSION',
  reason: 'System permissions are protected to maintain application security'
})

/* =========================
 * Dynamic Permission Error Functions - Các hàm tạo lỗi động
 * Phục vụ: Tạo error messages với context cụ thể
 * ========================= */

/**
 * Lỗi khi permission đã active với tên cụ thể
 */
export function createPermissionAlreadyActiveError(permissionName: string) {
  return new BadRequestException({
    message: `Permission "${permissionName}" is already active`,
    errorCode: 'PERMISSION_ALREADY_ACTIVE',
    permissionName
  })
}

import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'

// =============== LỖI VALIDATION ĐƠN GIẢN ===============

/**
 * Lỗi khi permissions không tồn tại
 */
export function createPermissionNotFoundError(missingIds: string[]) {
  const message = `Permission not found`

  return new BadRequestException({
    message,
    errorCode: 'PERMISSION_NOT_FOUND',
    missingIds
  })
}

/**
 * Lỗi khi roles không tồn tại
 */
export function createRoleNotFoundError(missingIds: string[]) {
  const count = missingIds.length
  const message = count === 1 ? `Role not found: ${missingIds[0]}` : `Roles not found: ${missingIds.join(', ')}`

  return new BadRequestException({
    message,
    errorCode: 'ROLE_NOT_FOUND',
    missingIds
  })
}

/**
 * Lỗi khi users không tồn tại
 */
export function createUserNotFoundError(missingIds: string[]) {
  const count = missingIds.length
  const message = count === 1 ? `User not found: ${missingIds[0]}` : `Users not found: ${missingIds.join(', ')}`

  return new BadRequestException({
    message,
    errorCode: 'USER_NOT_FOUND',
    missingIds
  })
}

// =============== LỖI BUSINESS LOGIC ===============

/**
 * Lỗi khi không có quyền thực hiện thao tác
 */
export const InsufficientPrivilegesError = new ForbiddenException({
  message: 'You do not have permission to perform this action',
  errorCode: 'INSUFFICIENT_PRIVILEGES'
})

/**
 * Lỗi khi thao tác không hợp lệ
 */
export const InvalidOperationError = new BadRequestException({
  message: 'Invalid operation',
  errorCode: 'INVALID_OPERATION'
})

/**
 * Lỗi khi resource đã bị xóa
 */
export const ResourceDeletedError = new ConflictException({
  message: 'Resource has been deleted',
  errorCode: 'RESOURCE_DELETED'
})

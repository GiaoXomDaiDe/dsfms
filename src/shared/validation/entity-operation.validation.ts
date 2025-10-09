/**
 * Shared validation helpers for entity operations
 * Used across Role, User, Permission, Department services
 */
import { BadRequestException } from '@nestjs/common'

/**
 * Prevents user from performing operations on themselves
 * Common pattern for delete/update operations
 */
export function preventSelfOperation(actorId: string, targetId: string, operation: string): void {
  if (actorId === targetId) {
    throw new BadRequestException({
      message: `Cannot ${operation} yourself`,
      errorCode: 'CANNOT_SELF_OPERATE',
      operation
    })
  }
}

/**
 * Prevents admin role from being deleted (business rule protection)
 */
export function preventAdminDeletion(roleName: string): void {
  if (roleName === 'ADMINISTRATOR') {
    throw new BadRequestException({
      message: 'Administrator role cannot be deleted',
      errorCode: 'ADMIN_ROLE_PROTECTED',
      reason: 'System integrity protection'
    })
  }
}

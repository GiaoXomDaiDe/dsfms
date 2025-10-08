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

/**
 * Checks if resource is already active
 */
export function checkAlreadyActive(isActive: boolean, resourceName: string): void {
  if (isActive) {
    throw new BadRequestException({
      message: `${resourceName} is already active`,
      errorCode: 'ALREADY_ACTIVE',
      resourceName
    })
  }
}

/**
 * Validates entity exists
 */
export function validateEntityExists<T>(entity: T | null, entityType: string): asserts entity is T {
  if (!entity) {
    throw new BadRequestException({
      message: `${entityType} not found`,
      errorCode: 'ENTITY_NOT_FOUND',
      entityType
    })
  }
}

/**
 * Validates entity is active
 */
export function validateEntityActive(isActive: boolean, entityName: string, entityType: string): void {
  if (!isActive) {
    throw new BadRequestException({
      message: `${entityType} "${entityName}" is not active`,
      errorCode: 'ENTITY_INACTIVE',
      entityType,
      entityName
    })
  }
}

/**
 * Prevents user from being disabled when already not disabled
 */
export function validateUserCanBeDisabled(user: any): void {
  if (user.status === 'DISABLED' || user.deletedAt !== null) {
    throw new BadRequestException({
      message: 'User is already disabled',
      errorCode: 'USER_ALREADY_DISABLED'
    })
  }
}

/**
 * Prevents user from being enabled when already active
 */
export function validateUserCanBeEnabled(user: any): void {
  if (user.status !== 'DISABLED' && user.deletedAt === null) {
    throw new BadRequestException({
      message: 'User is not disabled',
      errorCode: 'USER_NOT_DISABLED'
    })
  }
}

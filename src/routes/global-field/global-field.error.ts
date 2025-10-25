import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

export class GlobalFieldNotFoundError extends NotFoundException {
  constructor() {
    super('Global field not found')
  }
}

export class GlobalFieldAlreadyExistsError extends ConflictException {
  constructor(fieldName: string) {
    super(`Global field with field name '${fieldName}' already exists`)
  }
}

export class InvalidParentFieldError extends BadRequestException {
  constructor() {
    super('Invalid parent field ID or parent field does not exist')
  }
}

export class CircularReferenceError extends BadRequestException {
  constructor() {
    super('Cannot set parent field - this would create a circular reference')
  }
}

export class InvalidFieldTypeError extends BadRequestException {
  constructor() {
    super('Invalid field type provided')
  }
}

export class InvalidRoleRequiredError extends BadRequestException {
  constructor() {
    super('Invalid role required provided')
  }
}

export class RequiredFieldMissingError extends BadRequestException {
  constructor(fieldName: string) {
    super(`Required field '${fieldName}' is missing`)
  }
}

export class GlobalFieldInUseError extends ConflictException {
  constructor() {
    super('Cannot delete global field - it is being used by other entities')
  }
}

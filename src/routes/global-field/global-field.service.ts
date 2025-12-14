import { Injectable } from '@nestjs/common'
import { CreateGlobalFieldDto, UpdateGlobalFieldDto } from '~/routes/global-field/global-field.dto'
import { GlobalFieldRepository } from './global-field.repository'
import {
  GlobalFieldNotFoundError,
  GlobalFieldAlreadyExistsError,
  InvalidParentFieldError,
  CircularReferenceError,
  RequiredFieldMissingError
} from './global-field.error'

@Injectable()
export class GlobalFieldService {
  constructor(private readonly globalFieldRepository: GlobalFieldRepository) {}

  async findAll() {
    return this.globalFieldRepository.findAll()
  }

  async findAllDetail() {
    return this.globalFieldRepository.findAllDetail()
  }

  async findById(id: string) {
    if (!id) {
      throw new RequiredFieldMissingError('id')
    }

    const globalField = await this.globalFieldRepository.findById(id)
    if (!globalField) {
      throw new GlobalFieldNotFoundError()
    }

    return globalField
  }

  async findByIdDetail(id: string) {
    if (!id) {
      throw new RequiredFieldMissingError('id')
    }

    const globalField = await this.globalFieldRepository.findByIdDetail(id)
    if (!globalField) {
      throw new GlobalFieldNotFoundError()
    }

    return globalField
  }

  async create(data: CreateGlobalFieldDto, createdById?: string) {
    // Check if this is a simple field creation (no children) or nested creation
    if (!data.children || data.children.length === 0) {
      // Simple field creation - existing logic
      return this.createSingleField(data, createdById)
    }

    // Nested field creation - handle parent with children
    return this.createFieldWithChildren(data, createdById)
  }

  private async createSingleField(data: CreateGlobalFieldDto, createdById?: string) {
    // Validate required fields
    if (!data.label) {
      throw new RequiredFieldMissingError('label')
    }
    if (!data.fieldName) {
      throw new RequiredFieldMissingError('fieldName')
    }
    if (!data.fieldType) {
      throw new RequiredFieldMissingError('fieldType')
    }

    // PART và CHECK_BOX bắt buộc phải có children
    if (
      (data.fieldType === 'PART' || data.fieldType === 'CHECK_BOX') &&
      (!data.children || data.children.length === 0)
    ) {
      throw new Error(`${data.fieldType} field must have at least one child field.`)
    }

    // Check if fieldName already exists
    const existingField = await this.globalFieldRepository.findByFieldName(data.fieldName)
    if (existingField) {
      throw new GlobalFieldAlreadyExistsError(data.fieldName)
    }

    // Validate parent field if provided
    if (data.parentId) {
      const parentExists = await this.globalFieldRepository.exists(data.parentId)
      if (!parentExists) {
        throw new InvalidParentFieldError()
      }
    }

    return this.globalFieldRepository.create(data, createdById)
  }

  private async createFieldWithChildren(data: CreateGlobalFieldDto, createdById?: string) {
    // Validate parent field
    if (!data.label) {
      throw new RequiredFieldMissingError('label')
    }
    if (!data.fieldName) {
      throw new RequiredFieldMissingError('fieldName')
    }
    if (!data.fieldType) {
      throw new RequiredFieldMissingError('fieldType')
    }

    // Validate that parent field type supports children
    if (data.fieldType !== 'PART' && data.fieldType !== 'CHECK_BOX') {
      throw new Error(
        `Field type '${data.fieldType}' cannot have children. Only PART and CHECK_BOX fields can have children.`
      )
    }

    // Bắt buộc phải có children cho PART và CHECK_BOX
    if (!data.children || data.children.length === 0) {
      throw new Error(`${data.fieldType} field must have at least one child field.`)
    }

    // Check if parent fieldName already exists
    const existingField = await this.globalFieldRepository.findByFieldName(data.fieldName)
    if (existingField) {
      throw new GlobalFieldAlreadyExistsError(data.fieldName)
    }

    // Validate parent field if provided
    if (data.parentId) {
      const parentExists = await this.globalFieldRepository.exists(data.parentId)
      if (!parentExists) {
        throw new InvalidParentFieldError()
      }
    }

    // Validate field hierarchy
    this.validateFieldHierarchy([data])

    // Create parent and children with proper relationships
    return this.globalFieldRepository.createFieldWithChildren(data, createdById)
  }

  private validateFieldHierarchy(fields: any[], allTempIds: Set<string> = new Set()) {
    // First pass: collect all tempIds in the hierarchy
    this.collectAllTempIds(fields, allTempIds)

    // Second pass: validate relationships
    this.validateHierarchyRelationships(fields, allTempIds)
  }

  private collectAllTempIds(fields: any[], tempIds: Set<string>) {
    for (const field of fields) {
      if (field.tempId) {
        if (tempIds.has(field.tempId)) {
          throw new Error(`Duplicate tempId '${field.tempId}' found in field hierarchy`)
        }
        tempIds.add(field.tempId)
      }

      // Recursively collect from children
      if (field.children && field.children.length > 0) {
        this.collectAllTempIds(field.children, tempIds)
      }
    }
  }

  private validateHierarchyRelationships(fields: any[], allTempIds: Set<string>) {
    for (const field of fields) {
      // Validate parent-child relationships
      if (field.parentTempId && !allTempIds.has(field.parentTempId)) {
        throw new Error(`Parent field with tempId '${field.parentTempId}' not found for field '${field.fieldName}'`)
      }

      // Recursively validate children
      if (field.children && field.children.length > 0) {
        this.validateHierarchyRelationships(field.children, allTempIds)
      }
    }
  }

  async update(id: string, data: UpdateGlobalFieldDto, updatedById?: string) {
    if (!id) {
      throw new RequiredFieldMissingError('id')
    }

    // Check if this is a simple field update (no children) or hierarchical update
    if (!data.children || data.children.length === 0) {
      // Simple field update - existing logic
      return this.updateSingleField(id, data, updatedById)
    }

    // Hierarchical field update - handle parent with children
    return this.updateFieldWithChildren(id, data, updatedById)
  }

  private async updateSingleField(id: string, data: UpdateGlobalFieldDto, updatedById?: string) {
    // Check if global field exists
    const existingField = await this.globalFieldRepository.findByIdDetail(id)
    if (!existingField) {
      throw new GlobalFieldNotFoundError()
    }

    // Validate PART/CHECK_BOX fields must have children
    const updatedFieldType = data.fieldType || existingField.fieldType
    if (updatedFieldType === 'PART' || updatedFieldType === 'CHECK_BOX') {
      // Check if removing all children from a PART/CHECK_BOX field
      if (!data.children || data.children.length === 0) {
        throw new Error(`${updatedFieldType} field must have at least one child field.`)
      }
    }

    // Check if fieldName already exists (excluding current field)
    if (data.fieldName) {
      const fieldNameExists = await this.globalFieldRepository.fieldNameExists(data.fieldName, id)
      if (fieldNameExists) {
        throw new GlobalFieldAlreadyExistsError(data.fieldName)
      }
    }

    // Validate parent field if provided
    if (data.parentId) {
      const parentExists = await this.globalFieldRepository.exists(data.parentId)
      if (!parentExists) {
        throw new InvalidParentFieldError()
      }

      // Check for circular reference
      const wouldCreateCircularRef = await this.globalFieldRepository.checkCircularReference(id, data.parentId)
      if (wouldCreateCircularRef) {
        throw new CircularReferenceError()
      }
    }

    return this.globalFieldRepository.update(id, data, updatedById)
  }

  private async updateFieldWithChildren(id: string, data: UpdateGlobalFieldDto, updatedById?: string) {
    // Check if global field exists
    const existingField = await this.globalFieldRepository.findByIdDetail(id)
    if (!existingField) {
      throw new GlobalFieldNotFoundError()
    }

    // Validate that field type supports children updates
    if (data.fieldType && data.fieldType !== 'PART' && data.fieldType !== 'CHECK_BOX') {
      throw new Error(
        `Field type '${data.fieldType}' cannot have children. Only PART and CHECK_BOX fields can have children.`
      )
    }

    if (existingField.fieldType !== 'PART' && existingField.fieldType !== 'CHECK_BOX') {
      throw new Error(
        `Existing field type '${existingField.fieldType}' cannot have children. Only PART and CHECK_BOX fields can have children.`
      )
    }

    // Validate PART/CHECK_BOX fields must have children
    if (!data.children || data.children.length === 0) {
      const fieldType = data.fieldType || existingField.fieldType
      throw new Error(`${fieldType} field must have at least one child field.`)
    }

    // Check if fieldName already exists (excluding current field)
    if (data.fieldName) {
      const fieldNameExists = await this.globalFieldRepository.fieldNameExists(data.fieldName, id)
      if (fieldNameExists) {
        throw new GlobalFieldAlreadyExistsError(data.fieldName)
      }
    }

    // Validate field hierarchy for new children
    if (data.children) {
      this.validateUpdateHierarchy(data.children)
    }

    // Update parent and manage children
    return this.globalFieldRepository.updateFieldWithChildren(id, data, updatedById)
  }

  private validateUpdateHierarchy(children: any[]) {
    const tempIds = new Set<string>()

    for (const child of children) {
      // Check for duplicate tempIds in new children
      if (child.tempId) {
        if (tempIds.has(child.tempId)) {
          throw new Error(`Duplicate tempId '${child.tempId}' found in children updates`)
        }
        tempIds.add(child.tempId)
      }

      // Validate fieldName for new children
      if (!child.id && (!child.fieldName || !child.label)) {
        throw new Error('New child fields must have both label and fieldName')
      }

      // Recursively validate nested children
      if (child.children && child.children.length > 0) {
        this.validateUpdateHierarchy(child.children)
      }
    }
  }

  async delete(id: string) {
    if (!id) {
      throw new RequiredFieldMissingError('id')
    }

    // Check if global field exists and get its details
    const existingField = await this.globalFieldRepository.findByIdDetail(id)
    if (!existingField) {
      throw new GlobalFieldNotFoundError()
    }

    // Check if field has children
    if (existingField.children && existingField.children.length > 0) {
      // Use cascading delete for parent fields with children
      return this.globalFieldRepository.deleteWithChildren(id)
    } else {
      // Simple delete for fields without children
      return this.globalFieldRepository.delete(id)
    }
  }
}

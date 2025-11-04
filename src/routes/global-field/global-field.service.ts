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

  async update(id: string, data: UpdateGlobalFieldDto, updatedById?: string) {
    if (!id) {
      throw new RequiredFieldMissingError('id')
    }

    // Check if global field exists
    const existingField = await this.globalFieldRepository.exists(id)
    if (!existingField) {
      throw new GlobalFieldNotFoundError()
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

  async delete(id: string) {
    if (!id) {
      throw new RequiredFieldMissingError('id')
    }

    // Check if global field exists
    const existingField = await this.globalFieldRepository.exists(id)
    if (!existingField) {
      throw new GlobalFieldNotFoundError()
    }

    return this.globalFieldRepository.delete(id)
  }
}

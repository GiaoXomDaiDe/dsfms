import { Body, Controller, Get, Post, Patch, Param, Delete } from '@nestjs/common'
import { GlobalFieldService } from './global-field.service'
import { CreateGlobalFieldDto, UpdateGlobalFieldDto } from '~/routes/global-field/global-field.dto'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'

@Controller('global-fields')
export class GlobalFieldController {
  constructor(private readonly globalFieldService: GlobalFieldService) {}

  /**
   * GET /global-fields
   * Get all top-level global fields with their children (PART and CHECK_BOX fields show nested structure)
   */
  @Get()
  async getAllGlobalFields() {
    try {
      const globalFields = await this.globalFieldService.findAll()
      return {
        success: true,
        data: globalFields,
        message: 'Global fields retrieved successfully'
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * GET /global-fields/detail
   * Get all top-level global fields with complete hierarchical detail information
   */
  @Get('detail')
  async getAllGlobalFieldsDetail() {
    try {
      const globalFields = await this.globalFieldService.findAllDetail()
      return {
        success: true,
        data: globalFields,
        message: 'Global fields detail retrieved successfully'
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * GET /global-fields/:id
   * Get global field by ID with its children structure
   */
  @Get(':id')
  async getGlobalField(@Param('id') id: string) {
    try {
      const globalField = await this.globalFieldService.findById(id)
      return {
        success: true,
        data: globalField,
        message: 'Global field retrieved successfully'
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * GET /global-fields/:id/detail
   * Get global field by ID with complete hierarchical detail information
   */
  @Get(':id/detail')
  async getGlobalFieldDetail(@Param('id') id: string) {
    try {
      const globalField = await this.globalFieldService.findByIdDetail(id)
      return {
        success: true,
        data: globalField,
        message: 'Global field detail retrieved successfully'
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * POST /global-fields
   * Create new global field with support for nested children (PART and CHECK_BOX fields)
   */
  @Post()
  async createGlobalField(
    @Body() createGlobalFieldDto: CreateGlobalFieldDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    try {
      const globalField = await this.globalFieldService.create(createGlobalFieldDto, userId)
      return {
        success: true,
        data: globalField,
        message: 'Global field created successfully'
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * PATCH /global-fields/:id
   * Update global field by ID with support for hierarchical children updates (PART and CHECK_BOX fields)
   * 
   * Examples:
   * 
   * 1. Simple field update:
   * {
   *   "label": "Updated Student Name",
   *   "roleRequired": "TEACHER"
   * }
   * 
   * 2. PART field with children updates:
   * {
   *   "label": "Updated Personal Information",
   *   "children": [
   *     {
   *       "id": "existing-child-id",
   *       "label": "Updated First Name"
   *     },
   *     {
   *       "id": "child-to-delete-id",
   *       "_delete": true
   *     },
   *     {
   *       "label": "New Middle Name",
   *       "fieldName": "middleName",
   *       "tempId": "newChild1"
   *     }
   *   ]
   * }
   * 
   * 3. CHECK_BOX field children management:
   * {
   *   "label": "Updated Skills Assessment",
   *   "children": [
   *     {
   *       "id": "skill1-id",
   *       "label": "Advanced Communication Skills"
   *     },
   *     {
   *       "label": "Leadership Skills",
   *       "fieldName": "leadershipSkills"
   *     }
   *   ]
   * }
   */
  @Patch(':id')
  async updateGlobalField(
    @Param('id') id: string,
    @Body() updateData: UpdateGlobalFieldDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    try {
      const globalField = await this.globalFieldService.update(id, updateData, userId)
      return {
        success: true,
        data: globalField,
        message: 'Global field updated successfully'
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * DELETE /global-fields/:id
   * Delete global field by ID
   */
  @Delete(':id')
  async deleteGlobalField(
    @Param('id') id: string,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    try {
      await this.globalFieldService.delete(id)
      return {
        success: true,
        message: 'Global field deleted successfully'
      }
    } catch (error) {
      throw error
    }
  }
}

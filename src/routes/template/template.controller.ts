import { Controller, Post, Get, Param, Body, Query, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ZodSerializerDto } from 'nestjs-zod'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import { ParseTemplateResponseDTO, ExtractFieldsResponseDTO, CreateTemplateFormDto } from './template.dto'
import { TemplateService } from './template.service'

@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /**
   * POST /templates/parse
   * Parse DOCX template and return full schema with sections
   */
  @Post('parse')
  @IsPublic()
  @UseInterceptors(FileInterceptor('file'))
  @ZodSerializerDto(ParseTemplateResponseDTO)
  async parseTemplate(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded')
    }

    if (!file.originalname.endsWith('.docx')) {
      throw new BadRequestException('Only .docx files are allowed')
    }

    return await this.templateService.parseDocxTemplate(file)
  }

  /**
   * POST /templates/extract-fields
   * Extract only field names from DOCX without template/section structure
   * Returns a flat list of unique fields found in the document
   */
  @Post('extract-fields')
  @IsPublic()
  @UseInterceptors(FileInterceptor('file'))
  @ZodSerializerDto(ExtractFieldsResponseDTO)
  async extractFields(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded')
    }

    if (!file.originalname.endsWith('.docx')) {
      throw new BadRequestException('Only .docx files are allowed')
    }

    return await this.templateService.extractFieldsFromDocx(file)
  }

  /**
   * POST /templates/extract-fields-from-url
   * Extract field names from DOCX file hosted on S3
   */
  @Post('extract-fields-from-url')
  @IsPublic()
  @ZodSerializerDto(ExtractFieldsResponseDTO)
  async extractFieldsFromUrl(@Body() body: { url: string }) {
    if (!body.url) {
      throw new BadRequestException('URL is required')
    }

    if (!body.url.endsWith('.docx')) {
      throw new BadRequestException('URL must point to a .docx file')
    }

    // Validate S3 URL format (optional but recommended)
    const s3UrlPattern = /^https:\/\/.*\.s3\..*\.amazonaws\.com\/.*\.docx$/
    if (!s3UrlPattern.test(body.url)) {
      throw new BadRequestException('Invalid S3 URL format')
    }

    return await this.templateService.extractFieldsFromS3Url(body.url)
  }

  /**
   * POST /templates
   * Requires ADMINISTRATOR role authentication
   */
  @Post()
  async createTemplate(
    @Body() createTemplateDto: CreateTemplateFormDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.templateService.createTemplate(createTemplateDto, userContext)
  }

  /**
   * GET /templates/:id
   */
  @Get(':id')
  async getTemplateById(@Param('id') id: string) {
    try {
      return await this.templateService.getTemplateById(id)
    } catch (error) {
      throw error
    }
  }

  /**
   * GET /templates/:id/schema
   * Get template in the same format as create template API
   * Useful for editing or cloning templates
   */
  @Get(':id/schema')
  async getTemplateSchema(@Param('id') id: string) {
    try {
      return await this.templateService.getTemplateSchemaById(id)
    } catch (error) {
      throw error
    }
  }

  /**
   * GET /templates?status=PUBLISHED
   * Get all templates with optional status filtering
   */
  @Get()
  async getAllTemplates(@Query('status') status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED') {
    try {
      return await this.templateService.getAllTemplates(status)
    } catch (error) {
      throw error
    }
  }

  /**
   * GET /templates/department/:departmentId?status=PUBLISHED
   * Get templates by department with optional status filtering
   */
  @Get('department/:departmentId')
  async getTemplatesByDepartment(
    @Param('departmentId') departmentId: string,
    @Query('status') status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED'
  ) {
    try {
      return await this.templateService.getTemplatesByDepartment(departmentId, status)
    } catch (error) {
      throw error
    }
  }
}

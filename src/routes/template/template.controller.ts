import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
  Header
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ZodSerializerDto } from 'nestjs-zod'
import type { Response } from 'express'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { ActiveRolePermissions } from '~/shared/decorators/active-role-permissions.decorator'
import {
  ParseTemplateResponseDTO,
  ExtractFieldsResponseDTO,
  CreateTemplateFormDto,
  UpdateTemplateFormDto,
  CreateTemplateVersionDto,
  ReviewTemplateBodyDTO,
  ReviewTemplateResDTO
} from './template.dto'
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
   * Create Template Form and its Template Sections and Fields
   * Status: Optional field, defaults to DRAFT if not provided. Only DRAFT and PENDING are allowed during creation.
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
   * GET /templates?status=PUBLISHED
   * Get all system templates with optional status filtering
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
   * GET /templates/my-templates?status=DRAFT
   * Get all templates created by the current user with optional status filtering
   */
  @Get('my-templates')
  async getMyTemplates(
    @ActiveUser('userId') userId: string,
    @Query('status') status?: 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED' | 'DRAFT'
  ) {
    try {
      return await this.templateService.getTemplatesByUser(userId, status)
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

  /**
   * GET /templates/pdf/:templateFormId
   * convert Docx to PDF for Template Content (Template without Fields)
   */
  @Get('pdf/:templateFormId')
  @Header('Content-Type', 'application/pdf')
  async getTemplatePdf(
    @Param('templateFormId') templateFormId: string,
    @Res() res: Response,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] }
  ) {
    const pdfBuffer = await this.templateService.getTemplatePdf(templateFormId)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="template-${templateFormId}.pdf"`
    })
    res.send(pdfBuffer)
  }

  /**
   * GET /templates/pdf-config/:templateFormId
   * convert Docx to PDF for Template Configuration (Template with Fields)
   */
  @Get('pdf-config/:templateFormId')
  @Header('Content-Type', 'application/pdf')
  async getTemplateConfigPdf(
    @Param('templateFormId') templateFormId: string,
    @Res() res: Response,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] }
  ) {
    const pdfBuffer = await this.templateService.getTemplateConfigPdf(templateFormId)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="template-config-${templateFormId}.pdf"`
    })
    res.send(pdfBuffer)
  }

  /**
   * GET /templates/pdf-both/:templateFormId
   * convert Docx to PDF for both Template Content and Template Configuration(Template without Fields)
   */
  @Get('pdf-both/:templateFormId')
  async getTemplateBothPdf(
    @Param('templateFormId') templateFormId: string,
    @Res() res: Response,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] }
  ) {
    const zipBuffer = await this.templateService.getTemplateBothPdf(templateFormId)
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="template-${templateFormId}.zip"`
    })
    res.send(zipBuffer)
  }

  /**
   * GET /templates/pdf-content-test
   * Test endpoint for exporting PDF from S3 URL
   */
  @Get('pdf-content-test')
  @Header('Content-Type', 'application/pdf')
  async getTemplatePdfFromS3(
    @Body() body: { templateContentUrl: string },
    @Res() res: Response,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] }
  ) {
    if (!body.templateContentUrl) {
      throw new BadRequestException('templateContentUrl is required')
    }

    const pdfBuffer = await this.templateService.exportTemplatePdfFromS3(body.templateContentUrl)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="template-${Date.now()}.pdf"`
    })
    res.send(pdfBuffer)
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
   * GET /templates/:id
   * Get template by ID, especially to use for update Template, show this on the FRONT END
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
   * PATCH /templates/:id/status
   * Enable/Disable a status of a template
   */
  @Patch(':id/status')
  async changeTemplateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'DISABLED' | 'REJECTED' },
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    try {
      return await this.templateService.changeTemplateStatus(id, body.status, userContext)
    } catch (error) {
      throw error
    }
  }

  /**
   * PATCH /templates/:id/review
   * Review template - approve or reject a PENDING template with email notification
   */
  @Patch(':id/review')
  @ZodSerializerDto(ReviewTemplateResDTO)
  async reviewTemplate(
    @Param('id') id: string,
    @Body() body: ReviewTemplateBodyDTO,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.templateService.reviewTemplate(id, body, userContext)
  }

  /**
   * PATCH /templates/:id
   * Update template basic information (name, description, departmentId)
   */
  @Patch(':id')
  async updateTemplateForm(
    @Param('id') id: string,
    @Body() updateData: UpdateTemplateFormDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    try {
      return await this.templateService.updateTemplateForm(id, updateData, userContext)
    } catch (error) {
      throw error
    }
  }

  /**
   * POST /templates/create-version
   * Create a new version of an existing template
   */
  @Post('create-version')
  async createTemplateVersion(
    @Body() createVersionDto: CreateTemplateVersionDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    return await this.templateService.createTemplateVersion(createVersionDto, userContext)
  }

  /**
   * PUT /templates/update-draft/:id
   * Update a DRAFT template with new content, allowing status change to DRAFT or PENDING
   * Preserves original metadata (createdAt, createdBy, version, referFirstVersionId)
   */
  @Put('update-draft/:id')
  async updateDraftTemplate(
    @Param('id') id: string,
    @Body() updateTemplateDto: CreateTemplateFormDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    try {
      return await this.templateService.updateDraftTemplate(id, updateTemplateDto, userContext)
    } catch (error) {
      throw error
    }
  }

  /**
   * PUT /templates/update-rejected/:id
   * Update a REJECTED template with new content, resetting status to PENDING
   * Preserves original metadata (createdAt, createdBy, version, referFirstVersionId)
   */
  @Put('update-rejected/:id')
  async updateRejectedTemplate(
    @Param('id') id: string,
    @Body() updateTemplateDto: CreateTemplateFormDto,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    try {
      return await this.templateService.updateRejectedTemplate(id, updateTemplateDto, userContext)
    } catch (error) {
      throw error
    }
  }

  /**
   * DELETE /templates/draft/:id
   * Delete a DRAFT template permanently
   * Only DRAFT templates can be deleted, and only by users in the same department
   */
  @Delete('draft/:id')
  async deleteDraftTemplate(
    @Param('id') id: string,
    @ActiveUser('userId') userId: string,
    @ActiveRolePermissions() rolePermissions: { name: string; permissions?: any[] },
    @ActiveUser() currentUser: { userId: string; departmentId?: string }
  ) {
    const userContext = {
      userId,
      roleName: rolePermissions.name,
      departmentId: currentUser.departmentId
    }

    try {
      const result = await this.templateService.deleteDraftTemplate(id, userContext)
      return result
    } catch (error) {
      throw error
    }
  }
}

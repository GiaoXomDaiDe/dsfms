import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ZodSerializerDto } from 'nestjs-zod'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { ActiveUser } from '~/shared/decorators/active-user.decorator'
import { ParseTemplateResponseDTO, CreateTemplateFormDto } from './template.dto'
import { TemplateService } from './template.service'

@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /**
   * POST /templates/parse
   * Upload a DOCX file and parse its placeholders to generate JSON schema
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
   * POST /templates
   * Create a new template with sections and fields
   * Only ADMINISTRATOR role can create templates
   */
  @Post()
  async createTemplate(
    @Body() createTemplateDto: CreateTemplateFormDto,
    @ActiveUser() currentUser: any
  ) {
    try {
      return await this.templateService.createTemplate(createTemplateDto, currentUser);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /templates/:id
   * Get template by ID with full details
   */
  @Get(':id')
  async getTemplateById(@Param('id') id: string) {
    try {
      return await this.templateService.getTemplateById(id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /templates
   * Get all templates
   */
  @Get()
  // @UseGuards(JwtGuard)
  async getAllTemplates() {
    try {
      console.log("here");
      return await this.templateService.getAllTemplates();
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /templates/department/:departmentId
   * Get templates by department
   */
  @Get('department/:departmentId')
  async getTemplatesByDepartment(@Param('departmentId') departmentId: string) {
    try {
      return await this.templateService.getTemplatesByDepartment(departmentId);
    } catch (error) {
      throw error;
    }
  }
}

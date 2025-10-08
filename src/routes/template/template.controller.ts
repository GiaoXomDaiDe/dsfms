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
   */
  @Post()
  @IsPublic()
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
   */
  @Get(':id')
  @IsPublic()
  async getTemplateById(@Param('id') id: string) {
    try {
      return await this.templateService.getTemplateById(id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /templates
   */
  @Get()
  @IsPublic()
  async getAllTemplates() {
    try {
      return await this.templateService.getAllTemplates();
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /templates/department/:departmentId
   */
  @Get('department/:departmentId')
  @IsPublic()
  async getTemplatesByDepartment(@Param('departmentId') departmentId: string) {
    try {
      return await this.templateService.getTemplatesByDepartment(departmentId);
    } catch (error) {
      throw error;
    }
  }
}

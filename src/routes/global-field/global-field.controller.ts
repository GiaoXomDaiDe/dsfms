import { Body, Controller, Get, Post, Put, Param, UseGuards } from '@nestjs/common';
import { GlobalFieldService } from './global-field.service';
import { CreateGlobalFieldDto, UpdateGlobalFieldDto, GetGlobalFieldByIdDto } from '~/routes/global-field/global-field.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { ActiveUser } from '~/shared/decorators/active-user.decorator';

@Controller()
@UseGuards(JwtGuard)
export class GlobalFieldController {
  constructor(private readonly globalFieldService: GlobalFieldService) {}

  @Get('global-fields')
  async getAllGlobalFields() {
    try {
      const globalFields = await this.globalFieldService.findAll();
      return {
        success: true,
        data: globalFields,
        message: 'Global fields retrieved successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('global-fields/detail')
  async getAllGlobalFieldsDetailed() {
    try {
      const globalFields = await this.globalFieldService.findAllDetailed();
      return {
        success: true,
        data: globalFields,
        message: 'Global fields detailed retrieved successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('global-field')
  async getGlobalField(@Body() body: GetGlobalFieldByIdDto) {
    try {
      const globalField = await this.globalFieldService.findById(body.id);
      return {
        success: true,
        data: globalField,
        message: 'Global field retrieved successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('global-field/detail')
  async getGlobalFieldDetailed(@Body() body: GetGlobalFieldByIdDto) {
    try {
      const globalField = await this.globalFieldService.findByIdDetailed(body.id);
      return {
        success: true,
        data: globalField,
        message: 'Global field detailed retrieved successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('global-field')
  async createGlobalField(
    @Body() createGlobalFieldDto: CreateGlobalFieldDto,
    @ActiveUser() currentUser: any,
  ) {
    try {
      const globalField = await this.globalFieldService.create(createGlobalFieldDto, currentUser?.id);
      return {
        success: true,
        data: globalField,
        message: 'Global field created successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  @Put('global-field')
  async updateGlobalField(
    @Body() body: UpdateGlobalFieldDto & { id: string },
    @ActiveUser() currentUser: any,
  ) {
    try {
      const { id, ...updateData } = body;
      const globalField = await this.globalFieldService.update(id, updateData, currentUser?.id);
      return {
        success: true,
        data: globalField,
        message: 'Global field updated successfully',
      };
    } catch (error) {
      throw error;
    }
  }
}
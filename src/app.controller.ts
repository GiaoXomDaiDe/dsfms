import { Controller, Get } from '@nestjs/common'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @IsPublic()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      message: 'DSFMS API is running successfully!'
    }
  }
}

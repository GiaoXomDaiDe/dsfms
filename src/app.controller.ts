import { Controller, Get } from '@nestjs/common'
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
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

  @Get()
  getRoot() {
    return {
      message: 'Welcome to DSFMS API',
      status: 'running',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        docs: '/api',
        auth: '/auth',
        users: '/users',
        roles: '/roles',
        departments: '/departments'
      }
    }
  }
}

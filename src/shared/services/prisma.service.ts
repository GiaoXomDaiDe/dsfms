import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { isCannotReachDatabasePrismaError } from '~/shared/helper'

const cannotReachDatabase = new Error('Cannot reach the database')
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      transactionOptions: {
        maxWait: 20000, // 20 seconds
        timeout: 30000, // 30 seconds
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('Database connected successfully')
    } catch (error) {
      if (isCannotReachDatabasePrismaError(error)) {
        throw cannotReachDatabase
      }
    }
  }
}

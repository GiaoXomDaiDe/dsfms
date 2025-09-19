import { Global, Module } from '@nestjs/common'
import { HashingService } from '~/shared/services/hashing.service'
import { PrismaService } from '~/shared/services/prisma.service'

const sharedService = [PrismaService, HashingService]
@Global()
@Module({
  providers: sharedService,
  exports: sharedService
})
export class SharedModule {}

import { Module } from '@nestjs/common'
import { EmailService } from './email.service'
import { NodemailerService } from './nodemailer.service'
import { EmailController } from './email.controller'

@Module({
  controllers: [EmailController],
  providers: [EmailService, NodemailerService],
  exports: [EmailService, NodemailerService]
})
export class EmailModule {}

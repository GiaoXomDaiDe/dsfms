import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { SendEmailDto, BulkEmailDto } from '~/dto/email.dto';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    return this.emailService.sendEmail(sendEmailDto);
  }

  @Post('bulk-send')
  async sendBulkEmail(@Body() bulkEmailDto: BulkEmailDto) {
    return this.emailService.sendBulkEmail(bulkEmailDto);
  }

  @Post('bulk-simple')
  async bulkEmailSending(@Body() body: { recipients: string[] }) {
    return this.emailService.bulkEmailSending(body.recipients);
  }
}
import { Controller, Post, Body, Query } from '@nestjs/common'
import { EmailService } from './email.service'
import { NodemailerService } from './nodemailer.service'
import { SendEmailDto, BulkEmailDto } from '~/routes/email/email.dto'

@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService, // AWS SES
    private readonly nodemailerService: NodemailerService // Gmail SMTP
  ) {}

  @Post('send')
  async sendEmail(@Body() sendEmailDto: SendEmailDto, @Query('provider') provider?: string) {
    // Default to nodemailer (Gmail), but allow AWS SES
    if (provider === 'ses') {
      return this.emailService.sendEmail(sendEmailDto)
    }

    // Use Nodemailer (Gmail) by default
    return this.nodemailerService.sendEmail({
      to: sendEmailDto.to,
      subject: sendEmailDto.subject,
      html: sendEmailDto.htmlBody,
      text: sendEmailDto.textBody
    })
  }

  @Post('bulk-send')
  async sendBulkEmail(@Body() bulkEmailDto: BulkEmailDto, @Query('provider') provider?: string) {
    if (provider === 'ses') {
      return this.emailService.sendBulkEmail(bulkEmailDto)
    }

    // Convert to Nodemailer format
    const nodemailerEmails = bulkEmailDto.recipients.map((recipient) => ({
      to: recipient,
      subject: bulkEmailDto.subject,
      html: bulkEmailDto.htmlBody,
      text: bulkEmailDto.textBody
    }))

    return this.nodemailerService.sendBulkEmails(nodemailerEmails)
  }

  @Post('bulk-simple')
  async bulkEmailSending(
    @Body() body: { recipients: string[]; subject?: string; content?: string },
    @Query('provider') provider?: string
  ) {
    if (provider === 'ses') {
      return this.emailService.bulkEmailSending(body.recipients)
    }

    // Use Nodemailer for bulk simple emails
    const subject = body.subject || 'Notification'
    const content = body.content || 'This is a test notification email.'

    const nodemailerEmails = body.recipients.map((recipient) => ({
      to: recipient,
      subject: subject,
      html: `<p>${content}</p>`,
      text: content
    }))

    return this.nodemailerService.sendBulkEmails(nodemailerEmails)
  }

  // AWS SES specific endpoints
  @Post('send-ses')
  async sendEmailSES(@Body() sendEmailDto: SendEmailDto) {
    return this.emailService.sendEmail(sendEmailDto)
  }

  @Post('bulk-send-ses')
  async sendBulkEmailSES(@Body() bulkEmailDto: BulkEmailDto) {
    return this.emailService.sendBulkEmail(bulkEmailDto)
  }

  // Nodemailer
  @Post('send-gmail')
  async sendEmailGmail(@Body() body: { to: string | string[]; subject: string; html?: string; text?: string }) {
    return this.nodemailerService.sendEmail(body)
  }

  @Post('bulk-send-gmail')
  async sendBulkEmailGmail(
    @Body() body: { emails: Array<{ to: string | string[]; subject: string; html?: string; text?: string }> }
  ) {
    return this.nodemailerService.sendBulkEmails(body.emails)
  }

  @Post('test-gmail-connection')
  async testGmailConnection() {
    const isConnected = await this.nodemailerService.verifyConnection()
    return {
      success: isConnected,
      provider: 'Gmail SMTP',
      message: isConnected ? 'Connection successful' : 'Connection failed'
    }
  }
}

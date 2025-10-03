import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { SendEmailDto, BulkEmailDto } from '~/routes/email/email.dto'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly sesClient: SESClient
  private readonly defaultFromEmail: string

  constructor(private readonly configService: ConfigService) {
    const awsRegion = this.configService.get('AWS_REGION')
    const awsAccessKeyId = this.configService.get('AWS_ACCESS_KEY_ID')
    const awsSecretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY')

    if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
      throw new Error('AWS credentials are required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY')
    }

    this.sesClient = new SESClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      }
    })

    this.defaultFromEmail = this.configService.get('SES_FROM_EMAIL') || ''
  }

  async sendEmail(emailData: SendEmailDto): Promise<{ messageId: string }> {
    try {
      const { to, cc, bcc, subject, textBody, htmlBody, from, replyTo } = emailData

      if (!textBody && !htmlBody) {
        throw new BadRequestException('Either textBody or htmlBody must be provided')
      }

      const command = new SendEmailCommand({
        Source: from || this.defaultFromEmail,
        Destination: {
          ToAddresses: [to],
          CcAddresses: cc,
          BccAddresses: bcc
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {
            ...(textBody && {
              Text: {
                Data: textBody,
                Charset: 'UTF-8'
              }
            }),
            ...(htmlBody && {
              Html: {
                Data: htmlBody,
                Charset: 'UTF-8'
              }
            })
          }
        },
        ...(replyTo && { ReplyToAddresses: [replyTo] })
      })

      const response = await this.sesClient.send(command)
      this.logger.log(`Email sent to ${to}. MessageId: ${response.MessageId}`)

      return { messageId: response.MessageId || 'unknown' }
    } catch (error) {
      this.logger.error(`Failed to send email to ${emailData.to}:`, error)
      throw new BadRequestException(`Failed to send email: ${error.message}`)
    }
  }

  async bulkEmailSending(recipients: string[]): Promise<{ success: number; failed: number; messageIds: string[] }> {
    //sửa lại sau
    const subject = 'Hello'
    const htmlBody = '<h1>Hello World</h1>'

    const results = {
      success: 0,
      failed: 0,
      messageIds: [] as string[]
    }

    // gửi theo batches để tránh quả tải
    const batchSize = 10
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize)

      const promises = batch.map(async (email) => {
        try {
          const emailDto: SendEmailDto = {
            to: email,
            subject: subject,
            htmlBody: htmlBody
          }

          const result = await this.sendEmail(emailDto)
          results.success++
          results.messageIds.push(result.messageId)
          return { email, success: true, messageId: result.messageId }
        } catch (error) {
          results.failed++
          this.logger.error(`Failed to send to ${email}:`, error)
          return { email, success: false, error: error.message }
        }
      })

      await Promise.allSettled(promises)
    }

    this.logger.log(`Bulk email completed: ${results.success} success, ${results.failed} failed`)
    return results
  }

  // sử dụng DTO để gửi API
  async sendBulkEmail(bulkEmailDto: BulkEmailDto): Promise<{ success: number; failed: number; messageIds: string[] }> {
    const { recipients, subject, textBody, htmlBody, from } = bulkEmailDto

    if (!textBody && !htmlBody) {
      throw new BadRequestException('Either textBody or htmlBody must be provided')
    }

    const results = {
      success: 0,
      failed: 0,
      messageIds: [] as string[]
    }

    // Send emails in batches
    const batchSize = 10
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize)

      const promises = batch.map(async (email) => {
        try {
          const emailDto: SendEmailDto = {
            to: email,
            subject: subject,
            textBody: textBody,
            htmlBody: htmlBody,
            from: from
          }

          const result = await this.sendEmail(emailDto)
          results.success++
          results.messageIds.push(result.messageId)
          return { email, success: true, messageId: result.messageId }
        } catch (error) {
          results.failed++
          this.logger.error(`Failed to send to ${email}:`, error)
          return { email, success: false, error: error.message }
        }
      })

      await Promise.allSettled(promises)
    }

    this.logger.log(`Bulk email completed: ${results.success} success, ${results.failed} failed`)
    return results
  }
}

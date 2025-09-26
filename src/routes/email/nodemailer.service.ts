import { Injectable } from '@nestjs/common'
import * as nodemailer from 'nodemailer'
import { Transporter } from 'nodemailer'
import envConfig from '~/shared/config'

export interface NodemailerEmailOptions {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

@Injectable()
export class NodemailerService {
  private transporter: Transporter

  constructor() {
    this.createTransporter()
  }

  private createTransporter() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: envConfig.GMAIL_USER,
        pass: envConfig.GMAIL_APP_PASSWORD
      }
    })
  }

  async sendEmail(options: NodemailerEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const mailOptions = {
        from: `"${envConfig.GMAIL_FROM_NAME}" <${envConfig.GMAIL_USER}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments
      }

      const result = await this.transporter.sendMail(mailOptions)
      
      return {
        success: true,
        messageId: result.messageId
      }
    } catch (error) {
      console.error('Nodemailer send error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async sendBulkEmails(emails: NodemailerEmailOptions[]): Promise<{
    success: boolean
    results: Array<{ success: boolean; messageId?: string; error?: string; recipient: string }>
  }> {
    const results = []
    
    for (const email of emails) {
      const recipient = Array.isArray(email.to) ? email.to[0] : email.to
      const result = await this.sendEmail(email)
      
      results.push({
        ...result,
        recipient
      })
    }

    const successCount = results.filter(r => r.success).length
    
    return {
      success: successCount === emails.length,
      results
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('Nodemailer connection verification failed:', error)
      return false
    }
  }

  async sendResetPasswordEmail(
    userEmail: string, 
    resetToken: string, 
    magicLink: string,
    userName?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Đọc email template
      const { readFileSync } = await import('fs')
      const { join } = await import('path')
      const templatePath = join(process.cwd(), 'src', 'shared', 'email-template', 'forgot-password.txt')
      let htmlTemplate = readFileSync(templatePath, 'utf-8')

      // Tạo reset link từ magic link và token
      const resetLink = `${magicLink}?token=${resetToken}`

      // Thay thế placeholders trong template
      htmlTemplate = htmlTemplate.replace('[Your_Logo_URL]', 'https://via.placeholder.com/150x50?text=DSFMS')
      htmlTemplate = htmlTemplate.replace('[Your_Magic_Link]', resetLink)
      
      // Thay thế tên nếu có
      if (userName) {
        htmlTemplate = htmlTemplate.replace('Chào bạn,', `Chào ${userName},`)
      }

      const emailData = {
        to: userEmail,
        subject: 'Đặt lại mật khẩu - DSFMS System',
        html: htmlTemplate,
        text: `Xin chào, bạn đã yêu cầu đặt lại mật khẩu. Vui lòng truy cập link sau để đặt lại: ${resetLink}`
      }

      const result = await this.sendEmail(emailData)
      
      if (result.success) {
        return {
          success: true,
          message: 'Reset password email sent successfully'
        }
      } else {
        return {
          success: false,
          message: 'Failed to send reset password email'
        }
      }
    } catch (error) {
      console.error(`Failed to send reset password email to ${userEmail}:`, error)
      return {
        success: false,
        message: 'Failed to send reset password email'
      }
    }
  }
}
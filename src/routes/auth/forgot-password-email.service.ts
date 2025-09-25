// import { Injectable, Logger } from '@nestjs/common'
// import { ConfigService } from '@nestjs/config'
// import { readFileSync } from 'fs'
// import { join } from 'path'
// import { EmailService } from '../email/email.service'
// import { NodemailerService } from '../email/nodemailer.service'

// @Injectable()
// export class ForgotPasswordEmailService {
//   private readonly logger = new Logger(ForgotPasswordEmailService.name)
  
//   constructor(
//     private readonly emailService: EmailService,
//     private readonly nodemailerService: NodemailerService,
//     private readonly configService: ConfigService
//   ) {}

//   async sendResetPasswordEmail(
//     userEmail: string, 
//     resetToken: string, 
//     userName?: string,
//     provider: 'ses' | 'gmail' = 'gmail'
//   ): Promise<{ success: boolean; message: string }> {
//     try {
//       // Đọc email template
//       const templatePath = join(process.cwd(), 'src', 'shared', 'email-template', 'forgot-password.txt')
//       let htmlTemplate = readFileSync(templatePath, 'utf-8')

//       // Tạo reset link - nhớ phải sửa cái này nha Hồng Phúc
//       const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:4000'
//       const resetLink = `${frontendUrl}/auth/reset-password?token=${resetToken}`

//       // Thay thế placeholders trong template
//       htmlTemplate = htmlTemplate.replace('[Your_Logo_URL]', 'https://via.placeholder.com/150x50?text=DSFMS')
//       htmlTemplate = htmlTemplate.replace('[Your_Magic_Link]', resetLink)
      
//       // Thay thế tên nếu có
//       if (userName) {
//         htmlTemplate = htmlTemplate.replace('Chào bạn,', `Chào ${userName},`)
//       }

//       const emailData = {
//         to: userEmail,
//         subject: 'Đặt lại mật khẩu - DSFMS System',
//         html: htmlTemplate,
//         text: `Xin chào, bạn đã yêu cầu đặt lại mật khẩu. Vui lòng truy cập link sau để đặt lại: ${resetLink}`
//       }

//       let result
//       if (provider === 'ses') {
//         // Sử dụng AWS SES
//         result = await this.emailService.sendEmail({
//           to: userEmail,
//           subject: emailData.subject,
//           htmlBody: emailData.html,
//           textBody: emailData.text
//         })
//         this.logger.log(`Reset password email sent via AWS SES to: ${userEmail}`)
//       } else {
//         // Sử dụng Gmail SMTP (default)
//         result = await this.nodemailerService.sendEmail(emailData)
//         this.logger.log(`Reset password email sent via Gmail SMTP to: ${userEmail}`)
//       }

//       return {
//         success: true,
//         message: 'Reset password email sent successfully'
//       }
//     } catch (error) {
//       this.logger.error(`Failed to send reset password email to ${userEmail}:`, error)
//       return {
//         success: false,
//         message: 'Failed to send reset password email'
//       }
//     }
//   }
// }
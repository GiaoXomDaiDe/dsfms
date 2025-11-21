import { Injectable } from '@nestjs/common'
import { promises as fs } from 'fs'
import * as nodemailer from 'nodemailer'
import { Transporter } from 'nodemailer'
import * as path from 'path'
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

  private async loadTemplate(templateFile: string): Promise<string> {
    const templatePath = path.join(__dirname, '../../shared/email-template', templateFile)
    return fs.readFile(templatePath, 'utf-8')
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

    const successCount = results.filter((r) => r.success).length

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
      let htmlTemplate = await this.loadTemplate('forgot-password.txt')

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

  async sendNewUserAccountEmail(
    userEmail: string,
    userEid: string,
    userPassword: string,
    fullName: string,
    userRole: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Read email template
      let htmlTemplate = await this.loadTemplate('new-user-account.txt')

      // Get current date
      const creationDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      // Replace placeholders in template
      htmlTemplate = htmlTemplate.replace('[LOGO_URL]', 'https://via.placeholder.com/150x50?text=DSFMS')
      htmlTemplate = htmlTemplate.replace('[FULL_NAME]', fullName)
      htmlTemplate = htmlTemplate.replace('[USER_EMAIL]', userEmail)
      htmlTemplate = htmlTemplate.replace('[USER_EID]', userEid)
      htmlTemplate = htmlTemplate.replace('[USER_ROLE]', userRole)
      htmlTemplate = htmlTemplate.replace('[USER_PASSWORD]', userPassword)
      htmlTemplate = htmlTemplate.replace('[CREATION_DATE]', creationDate)

      const emailData = {
        to: userEmail,
        subject: 'Welcome to DSFMS System - Your Account is Ready!',
        html: htmlTemplate,
        text: `Welcome to DSFMS System! Your account has been created successfully.
        
Login Credentials:
- Email: ${userEmail}
- Employee ID: ${userEid}
- Role: ${userRole}
- Temporary Password: ${userPassword}

IMPORTANT: Please change your password after your first login and keep your credentials secure.

This account was created on ${creationDate}.`
      }

      const result = await this.sendEmail(emailData)

      if (result.success) {
        return {
          success: true,
          message: 'New user account email sent successfully'
        }
      } else {
        return {
          success: false,
          message: 'Failed to send new user account email'
        }
      }
    } catch (error) {
      console.error(`Failed to send new user account email to ${userEmail}:`, error)
      return {
        success: false,
        message: 'Failed to send new user account email'
      }
    }
  }

  async sendBulkNewUserAccountEmails(
    users: Array<{
      email: string
      eid: string
      password: string
      fullName: string
      role: string
    }>
  ): Promise<{
    success: boolean
    results: Array<{
      email: string
      success: boolean
      message: string
    }>
  }> {
    const results = []

    for (const user of users) {
      const result = await this.sendNewUserAccountEmail(user.email, user.eid, user.password, user.fullName, user.role)

      results.push({
        email: user.email,
        success: result.success,
        message: result.message
      })
    }

    const successCount = results.filter((r) => r.success).length

    return {
      success: successCount === users.length,
      results
    }
  }

  /**
   * Send rejected assessment email notification
   */
  async sendRejectedAssessmentEmail(
    traineeEmail: string,
    traineeName: string,
    assessmentName: string,
    subjectOrCourseName: string,
    templateName: string,
    submissionDate: string,
    reviewerName: string,
    reviewDate: string,
    rejectionComment: string,
    assessmentUrl?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Read email template
      let htmlTemplate = await this.loadTemplate('rejected-assessment.txt')

      // Replace placeholders in template
      htmlTemplate = htmlTemplate.replace('[Your_Logo_URL]', 'https://via.placeholder.com/150x50?text=DSFMS')
      htmlTemplate = htmlTemplate.replace(/\[TRAINEE_NAME\]/g, traineeName)
      htmlTemplate = htmlTemplate.replace(/\[ASSESSMENT_NAME\]/g, assessmentName)
      htmlTemplate = htmlTemplate.replace(/\[SUBJECT_OR_COURSE_NAME\]/g, subjectOrCourseName)
      htmlTemplate = htmlTemplate.replace(/\[TEMPLATE_NAME\]/g, templateName)
      htmlTemplate = htmlTemplate.replace(/\[SUBMISSION_DATE\]/g, submissionDate)
      htmlTemplate = htmlTemplate.replace(/\[REVIEWER_NAME\]/g, reviewerName)
      htmlTemplate = htmlTemplate.replace(/\[REVIEW_DATE\]/g, reviewDate)
      htmlTemplate = htmlTemplate.replace(/\[REJECTION_COMMENT\]/g, rejectionComment || 'No specific comment provided.')
      htmlTemplate = htmlTemplate.replace(/\[ASSESSMENT_URL\]/g, assessmentUrl || '#')

      const emailData = {
        to: traineeEmail,
        subject: `Assessment Rejected - ${assessmentName}`,
        html: htmlTemplate,
        text: `Your assessment "${assessmentName}" has been rejected. Reason: ${rejectionComment}. Please review and resubmit.`
      }

      const result = await this.sendEmail(emailData)

      if (result.success) {
        return {
          success: true,
          message: 'Rejection notification email sent successfully'
        }
      } else {
        return {
          success: false,
          message: `Failed to send rejection notification email: ${result.error}`
        }
      }
    } catch (error) {
      console.error('Error sending rejected assessment email:', error)
      return {
        success: false,
        message: `Error sending rejection notification email: ${error.message}`
      }
    }
  }

  /**
   * Send email notification for approved template
   */
  async sendApprovedTemplateEmail(
    creatorEmail: string,
    creatorName: string,
    templateName: string,
    templateVersion: number,
    departmentName: string,
    creationDate: string,
    reviewerName: string,
    reviewDate: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      let htmlTemplate = await this.loadTemplate('approved-template.txt')

      // Replace placeholders with actual data
      htmlTemplate = htmlTemplate.replace(/\[CREATOR_NAME\]/g, creatorName)
      htmlTemplate = htmlTemplate.replace(/\[TEMPLATE_NAME\]/g, templateName)
      htmlTemplate = htmlTemplate.replace(/\[TEMPLATE_VERSION\]/g, templateVersion.toString())
      htmlTemplate = htmlTemplate.replace(/\[DEPARTMENT_NAME\]/g, departmentName)
      htmlTemplate = htmlTemplate.replace(/\[CREATION_DATE\]/g, creationDate)
      htmlTemplate = htmlTemplate.replace(/\[REVIEWER_NAME\]/g, reviewerName)
      htmlTemplate = htmlTemplate.replace(/\[REVIEW_DATE\]/g, reviewDate)

      const emailData = {
        to: creatorEmail,
        subject: `Template Approved - ${templateName}`,
        html: htmlTemplate,
        text: `Great news! Your template "${templateName}" has been approved and is now published for use.`
      }

      const result = await this.sendEmail(emailData)

      if (result.success) {
        return {
          success: true,
          message: 'Template approval notification email sent successfully'
        }
      } else {
        return {
          success: false,
          message: `Failed to send template approval notification email: ${result.error}`
        }
      }
    } catch (error) {
      console.error('Error sending approved template email:', error)
      return {
        success: false,
        message: `Error sending template approval notification email: ${error.message}`
      }
    }
  }

  /**
   * Send email notification for rejected template
   */
  async sendRejectedTemplateEmail(
    creatorEmail: string,
    creatorName: string,
    templateName: string,
    templateVersion: number,
    departmentName: string,
    creationDate: string,
    reviewerName: string,
    reviewDate: string,
    rejectionComment: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      let htmlTemplate = await this.loadTemplate('rejected-template.txt')

      // Replace placeholders with actual data
      htmlTemplate = htmlTemplate.replace(/\[CREATOR_NAME\]/g, creatorName)
      htmlTemplate = htmlTemplate.replace(/\[TEMPLATE_NAME\]/g, templateName)
      htmlTemplate = htmlTemplate.replace(/\[TEMPLATE_VERSION\]/g, templateVersion.toString())
      htmlTemplate = htmlTemplate.replace(/\[DEPARTMENT_NAME\]/g, departmentName)
      htmlTemplate = htmlTemplate.replace(/\[CREATION_DATE\]/g, creationDate)
      htmlTemplate = htmlTemplate.replace(/\[REVIEWER_NAME\]/g, reviewerName)
      htmlTemplate = htmlTemplate.replace(/\[REVIEW_DATE\]/g, reviewDate)
      htmlTemplate = htmlTemplate.replace(/\[REJECTION_COMMENT\]/g, rejectionComment || 'No specific comment provided.')

      const emailData = {
        to: creatorEmail,
        subject: `Template Rejected - ${templateName}`,
        html: htmlTemplate,
        text: `Your template "${templateName}" has been rejected. Reason: ${rejectionComment}. Please review the feedback and make necessary revisions.`
      }

      const result = await this.sendEmail(emailData)

      if (result.success) {
        return {
          success: true,
          message: 'Template rejection notification email sent successfully'
        }
      } else {
        return {
          success: false,
          message: `Failed to send template rejection notification email: ${result.error}`
        }
      }
    } catch (error) {
      console.error('Error sending rejected template email:', error)
      return {
        success: false,
        message: `Error sending template rejection notification email: ${error.message}`
      }
    }
  }
}

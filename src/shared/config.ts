import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import z from 'zod'

config()

const envPath = path.resolve('.env')

if (process.env.NODE_ENV !== 'test' && !fs.existsSync(envPath)) {
  console.warn('No .env file found, using existing environment variables')
}

//Schema kiểm tra biến môi trường có đủ ko
const configSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.string(),
  PASSWORD_SECRET: z.string(),
  SECRET_API_KEY: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  ACCESS_TOKEN_EXPIRES_IN: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),
  RESET_PASSWORD_SECRET: z.string(),
  AWS_REGION: z.string(),
  AWS_S3_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_SECRET_KEY: z.string(),
  AWS_S3_ACCESS_KEY: z.string(),
  AWS_S3_BUCKET_NAME: z.string(),
  SES_FROM_EMAIL: z.email(),
  GMAIL_USER: z.email(),
  GMAIL_APP_PASSWORD: z.string(),
  GMAIL_FROM_NAME: z.string(),
  FRONTEND_URL: z.url().optional(),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string(),
  ADMIN_FIRST_NAME: z.string(),
  ADMIN_LAST_NAME: z.string(),
  ADMIN_MIDDLE_NAME: z.string(),
  DEPARTMENT_HEAD_EMAIL: z.string(),
  DEPARTMENT_HEAD_PASSWORD: z.string(),
  DEPARTMENT_HEAD_FIRST_NAME: z.string(),
  DEPARTMENT_HEAD_LAST_NAME: z.string(),
  DEPARTMENT_HEAD_MIDDLE_NAME: z.string(),
  ACADEMIC_DEPARTMENT_EMAIL: z.email(),
  ACADEMIC_DEPARTMENT_PASSWORD: z.string(),
  ACADEMIC_DEPARTMENT_FIRST_NAME: z.string(),
  ACADEMIC_DEPARTMENT_LAST_NAME: z.string(),
  ACADEMIC_DEPARTMENT_MIDDLE_NAME: z.string(),
  ONLYOFFICE_COMMAND_SERVICE_URL: z.url().optional(),
  ONLYOFFICE_JWT_SECRET: z.string().optional()
})

const configServer = configSchema.safeParse(process.env)

if (!configServer.success) {
  console.error('Config env validation failed', configServer.error)
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1)
  }
}

const envConfig = configServer.data!

export default envConfig

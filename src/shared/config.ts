import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import z from 'zod'

config()

if (process.env.NODE_ENV !== 'test' && !fs.existsSync(path.resolve('.env'))) {
  console.log('Không tìm thấy file .env')
  process.exit(1)
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
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
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
  DEPARTMENT_HEAD_MIDDLE_NAME: z.string()
})

const getEnvVars = () => {
  if (process.env.NODE_ENV === 'test') {
    return {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      PORT: '3001',
      PASSWORD_SECRET: 'test-password-secret',
      SECRET_API_KEY: 'test-api-key',
      ACCESS_TOKEN_SECRET: 'test-access-secret',
      ACCESS_TOKEN_EXPIRES_IN: '15m',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret',
      REFRESH_TOKEN_EXPIRES_IN: '7d',
      RESET_PASSWORD_SECRET: 'test-reset-password-secret',
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-aws-key',
      AWS_SECRET_ACCESS_KEY: 'test-aws-secret',
      SES_FROM_EMAIL: 'test@example.com',
      GMAIL_USER: 'test@gmail.com',
      GMAIL_APP_PASSWORD: 'test-app-password',
      GMAIL_FROM_NAME: 'Test Sender',
      FRONTEND_URL: 'http://localhost:3000',
      ADMIN_EMAIL: 'admin@test.com',
      ADMIN_PASSWORD: 'test-password',
      ADMIN_FIRST_NAME: 'Test',
      ADMIN_LAST_NAME: 'Admin',
      ADMIN_MIDDLE_NAME: 'Test',
      DEPARTMENT_HEAD_EMAIL: 'head@test.com',
      DEPARTMENT_HEAD_PASSWORD: 'test-password',
      DEPARTMENT_HEAD_FIRST_NAME: 'Department',
      DEPARTMENT_HEAD_LAST_NAME: 'Head',
      DEPARTMENT_HEAD_MIDDLE_NAME: 'Test',
      ...process.env
    }
  }
  return process.env
}

const configServer = configSchema.safeParse(getEnvVars())

if (!configServer.success) {
  console.error('Config env validation failed', configServer.error)
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1)
  }
}

const envConfig = configServer.data!

export default envConfig

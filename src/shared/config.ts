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
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  SES_FROM_EMAIL: z.email(),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string(),
  ADMIN_FIRST_NAME: z.string(),
  ADMIN_LAST_NAME: z.string(),
  ADMIN_MIDDLE_NAME: z.string()
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
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-aws-key',
      AWS_SECRET_ACCESS_KEY: 'test-aws-secret',
      SES_FROM_EMAIL: 'test@example.com',
      ADMIN_EMAIL: 'admin@test.com',
      ADMIN_PASSWORD: 'test-password',
      ADMIN_FIRST_NAME: 'Test',
      ADMIN_LAST_NAME: 'Admin',
      ADMIN_MIDDLE_NAME: 'Middle',
      ...process.env // Allow overrides from actual env vars
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

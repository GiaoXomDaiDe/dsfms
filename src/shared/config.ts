import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import z from 'zod'

config()

if (!fs.existsSync(path.resolve('.env'))) {
  console.log('Không tìm thấy file .env')
  process.exit(1)
}

//Schema kiểm tra biến môi trường có đủ ko
const configSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.string(),
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

const configServer = configSchema.safeParse(process.env)

if (!configServer.success) {
  console.error('Config env validation failed', configServer.error)
  process.exit(1)
}

const envConfig = configServer.data

export default envConfig

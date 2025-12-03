import { NestFactory } from '@nestjs/core'
import envConfig from '~/shared/config'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose']
  })
  app.enableCors()
  await app.listen(envConfig.PORT ?? 4000)
  console.log('Runtime DATABASE_URL =', process.env.DATABASE_URL)
}
bootstrap()

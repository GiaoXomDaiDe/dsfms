import { NestFactory } from '@nestjs/core'
import envConfig from '~/shared/config'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors()
  await app.listen(envConfig.PORT ?? 4000)
}
bootstrap()

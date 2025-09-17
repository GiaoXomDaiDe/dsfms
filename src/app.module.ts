import { Module } from '@nestjs/common'
import { SharedModule } from '~/shared/shared.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [SharedModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}

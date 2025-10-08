import { Module } from '@nestjs/common'
import { TemplateController } from './template.controller'
import { TemplateService } from './template.service'
import { TemplateRepository } from './template.repository'
import { SharedModule } from '~/shared/shared.module'

@Module({
  imports: [SharedModule],
  controllers: [TemplateController],
  providers: [TemplateService, TemplateRepository],
  exports: [TemplateService, TemplateRepository]
})
export class TemplateModule {}

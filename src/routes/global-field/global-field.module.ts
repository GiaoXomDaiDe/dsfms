import { Module } from '@nestjs/common';
import { GlobalFieldController } from './global-field.controller';
import { GlobalFieldService } from './global-field.service';
import { GlobalFieldRepository } from './global-field.repository';
import { SharedModule } from '~/shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [GlobalFieldController],
  providers: [GlobalFieldService, GlobalFieldRepository],
  exports: [GlobalFieldService, GlobalFieldRepository],
})
export class GlobalFieldModule {}
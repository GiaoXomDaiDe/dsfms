import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { existsSync, mkdirSync } from 'fs'
import multer from 'multer'
import { MediaController } from '~/routes/media/media.controller'
import { MediaService } from '~/routes/media/media.service'
import { UPLOAD_DIR } from '~/shared/constants/default.constant'
import { generateRandomFilename } from '~/shared/helper'

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR)
  },
  filename: function (req, file, cb) {
    const newFilename = generateRandomFilename(file.originalname)
    cb(null, newFilename)
  }
})

@Module({
  imports: [
    MulterModule.register({
      storage
    }),
    HttpModule
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService]
})
export class MediaModule {
  constructor() {
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true })
    }
  }
}

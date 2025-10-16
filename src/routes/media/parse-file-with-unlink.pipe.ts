import { ParseFileOptions, ParseFilePipe } from '@nestjs/common'
import { unlink } from 'fs/promises'

export class ParseFilePipeWithUnlink extends ParseFilePipe {
  constructor(options?: ParseFileOptions) {
    super(options)
  }

  async transform(files: Array<Express.Multer.File>): Promise<any> {
    console.log('ParseFilePipeWithUnlink - files received:', files)
    return super.transform(files).catch(async (error) => {
      console.log('ParseFilePipeWithUnlink - validation error:', error.message)
      if (files && Array.isArray(files)) {
        console.log('ParseFilePipeWithUnlink - cleaning up files:', files.length)
        await Promise.all(files.map((file) => unlink(file.path)))
      }
      throw error
    })
  }
}

import { Module } from '@nestjs/common'
import { UserRepo } from '~/routes/user/user.repo'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepo]
})
export class UserModule {}

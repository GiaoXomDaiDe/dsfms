import { Module } from '@nestjs/common'
import { EmailModule } from '~/routes/email/email.module'
import { UserRepo } from '~/routes/user/user.repo'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [EmailModule],
  controllers: [UserController],
  providers: [UserService, UserRepo]
})
export class UserModule {}

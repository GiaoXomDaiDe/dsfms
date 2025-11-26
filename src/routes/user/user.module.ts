import { Module } from '@nestjs/common'
import { EmailModule } from '~/routes/email/email.module'
import { UserRepository } from '~/routes/user/user.repo'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [EmailModule],
  controllers: [UserController],
  providers: [UserService, UserRepository]
})
export class UserModule {}

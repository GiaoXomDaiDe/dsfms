import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { AccessTokenGuard } from '~/shared/guards/access-token.guard'
import { APIKeyGuard } from '~/shared/guards/api-key.guard'
import { AuthenticationGuard } from '~/shared/guards/authentication.guard'
import { SharedCourseRepository } from '~/shared/repositories/shared-course.repo'
import { SharedDepartmentRepository } from '~/shared/repositories/shared-department.repo'
import { SharedRoleRepository } from '~/shared/repositories/shared-role.repo'
import { SharedUserRepository } from '~/shared/repositories/shared-user.repo'
import { EidService } from '~/shared/services/eid.service'
import { HashingService } from '~/shared/services/hashing.service'
import { PrismaService } from '~/shared/services/prisma.service'
import { TokenService } from '~/shared/services/token.service'

const sharedServices = [
  PrismaService,
  HashingService,
  SharedUserRepository,
  SharedRoleRepository,
  SharedDepartmentRepository,
  SharedCourseRepository,
  TokenService,
  AccessTokenGuard,
  APIKeyGuard,
  EidService
]
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    ...sharedServices,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard
    }
  ],
  exports: [...sharedServices, JwtModule]
})
export class SharedModule {}

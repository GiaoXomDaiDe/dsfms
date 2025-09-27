import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ZodSerializerInterceptor } from 'nestjs-zod'
import { CourseModule } from '~/routes/course/course.module'
import { DepartmentModule } from '~/routes/department/department.module'
import { RoleModule } from '~/routes/role/role.module'
import { SubjectModule } from '~/routes/subject/subject.module'
import { UserModule } from '~/routes/user/user.module'
import { HttpExceptionFilter } from '~/shared/filters/http-exception.filter'
import CustomZodValidationPipe from '~/shared/pipes/custom-zod-vaidation.pipe'
import { SharedModule } from '~/shared/shared.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './routes/auth/auth.module'
import { EmailModule } from './routes/email/email.module'
import { PermissionModule } from './routes/permission/permission.module'
import { ProfileModule } from './routes/profile/profile.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    SharedModule,
    AuthModule,
    EmailModule,
    PermissionModule,
    RoleModule,
    UserModule,
    ProfileModule,
    DepartmentModule,
    CourseModule,
    SubjectModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: CustomZodValidationPipe
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    }
  ]
})
export class AppModule {}

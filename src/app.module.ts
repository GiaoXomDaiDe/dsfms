import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { ZodSerializerInterceptor } from 'nestjs-zod'
import { CourseModule } from '~/routes/course/course.module'
import { DepartmentModule } from '~/routes/department/department.module'
import { MediaModule } from '~/routes/media/media.module'
import { PublicModule } from '~/routes/public/public.module'
import { ReportsModule } from '~/routes/reports/reports.module'
import { RoleModule } from '~/routes/role/role.module'
import { SubjectModule } from '~/routes/subject/subject.module'
import { UserModule } from '~/routes/user/user.module'
import { HttpExceptionFilter } from '~/shared/filters/http-exception.filter'
import CustomZodValidationPipe from '~/shared/pipes/custom-zod-vaidation.pipe'
import { StatusUpdaterService } from '~/shared/services/status-updater.service'
import { SharedModule } from '~/shared/shared.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AssessmentModule } from './routes/assessment/assessment.module'
import { AuthModule } from './routes/auth/auth.module'
import { EmailModule } from './routes/email/email.module'
import { GlobalFieldModule } from './routes/global-field/global-field.module'
import { PermissionModule } from './routes/permission/permission.module'
import { ProfileModule } from './routes/profile/profile.module'
import { TemplateModule } from './routes/template/template.module'

@Module({
  imports: [
    ScheduleModule.forRoot({
      cronJobs: true
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    SharedModule,
    AuthModule,
    EmailModule,
    GlobalFieldModule,
    PermissionModule,
    RoleModule,
    UserModule,
    ProfileModule,
    DepartmentModule,
    CourseModule,
    SubjectModule,
    TemplateModule,
    AssessmentModule,
    ReportsModule,
    PublicModule,
    MediaModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    StatusUpdaterService,
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

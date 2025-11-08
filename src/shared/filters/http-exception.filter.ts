import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import type { Request } from 'express'
import { ZodSerializationException } from 'nestjs-zod'
import { ZodError as ZodErrorV4 } from 'zod/v4'

@Catch(HttpException)
export class HttpExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: HttpException, host: ArgumentsHost) {
    if (exception instanceof ZodSerializationException) {
      const zodError = exception.getZodError()
      const httpContext = host.switchToHttp()
      const request = httpContext.getRequest<Request>()
      const route = request ? `${request.method} ${request.originalUrl ?? request.url}` : 'Unknown route'
      console.log('Log thử: ', JSON.stringify(exception.initCause(), null, 2))
      if (zodError instanceof ZodErrorV4) {
        const serializedIssues = JSON.stringify(zodError.issues, null, 2)
        this.logger.error(`ZodSerializationException at ${route}`, serializedIssues)
      }
    }

    super.catch(exception, host)
  }
}

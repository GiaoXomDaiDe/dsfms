import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import envConfig from 'src/shared/config'

@Injectable()
export class APIKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const xApiKey = request.headers['x-api-key']
    if (xApiKey !== envConfig.SECRET_API_KEY) {
      throw new UnauthorizedException('Invalid API key')
    }
    return true
  }
}

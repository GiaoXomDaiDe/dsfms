import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-local'
import { AuthService } from '../auth.service'
import { Injectable } from '@nestjs/common'

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password'
    })
  }

  async validate(email: string, password: string): Promise<any> {
    // The validateUser method now throws appropriate exceptions
    // so we don't need to check for null/undefined
    return await this.authService.validateUser({ email, password })
  }
}

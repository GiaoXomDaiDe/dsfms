import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException
} from '@nestjs/common'

// 400 Bad Request
export const MissingCredentialsException = new BadRequestException({
  message: 'Email and password are required',
  error: 'MISSING_CREDENTIALS'
})

export const PasswordsDoNotMatchException = new BadRequestException({
  message: 'Passwords do not match',
  error: 'PASSWORDS_DO_NOT_MATCH'
})

export const InvalidRefreshTokenException = new BadRequestException({
  message: 'Invalid refresh token',
  error: 'INVALID_REFRESH_TOKEN'
})

// 401 Unauthorized
export const InvalidCredentialsException = new UnauthorizedException({
  message: 'Invalid email or password',
  error: 'INVALID_CREDENTIALS'
})

export const TokenExpiredException = new UnauthorizedException({
  message: 'Token has expired',
  error: 'TOKEN_EXPIRED'
})

export const InvalidTokenException = new UnauthorizedException({
  message: 'Invalid token',
  error: 'INVALID_TOKEN'
})

// 403 Forbidden
export const AccountDisabledException = new ForbiddenException({
  message: 'Account is disabled. Please contact administrator',
  error: 'ACCOUNT_DISABLED'
})

// 404 Not Found
export const UserNotFoundException = new NotFoundException({
  message: 'User not found',
  error: 'USER_NOT_FOUND'
})

// 500 Internal Server Error
export const AuthenticationServiceException = new InternalServerErrorException({
  message: 'Authentication service error',
  error: 'AUTH_SERVICE_ERROR'
})

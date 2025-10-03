import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuidv4 } from 'uuid'
import { AuthPayloadDto } from '~/routes/auth/auth.dto'
import envConfig from '~/shared/config'
import * as statusConst from '~/shared/constants/auth.constant'
import { HashingService } from '~/shared/services/hashing.service'
import { NodemailerService } from '../email/nodemailer.service'
import { AuthRepo, UserWithRelations } from './auth.repo'
import * as AuthErrors from './auth.error'

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private authRepo: AuthRepo,
    private hashingService: HashingService,
    private nodemailerService: NodemailerService
  ) {}

  async validateUser({ email, password }: AuthPayloadDto) {
    try {
      // Check if email and password are provided
      if (!email || !password) {
        throw AuthErrors.MissingCredentialsException
      }

      // Find user by email (including disabled users to check status)
      const user = await this.authRepo.findUserByEmail(email)

      if (!user) {
        throw AuthErrors.UserNotFoundException
      }

      // Check if account is disabled
      if (user.status === statusConst.UserStatus.DISABLED) {
        throw AuthErrors.AccountDisabledException
      }

      // Validate password
      const isPasswordValid = await this.hashingService.comparePassword(password, user.passwordHash)

      if (!isPasswordValid) {
        throw AuthErrors.InvalidCredentialsException
      }

      // Return user without password
      const { passwordHash, ...userWithoutPassword } = user
      return userWithoutPassword
    } catch (error) {
      // If it's one of our custom errors, re-throw it
      if (error instanceof AuthErrors.MissingCredentialsException.constructor ||
          error instanceof AuthErrors.UserNotFoundException.constructor ||
          error instanceof AuthErrors.AccountDisabledException.constructor ||
          error instanceof AuthErrors.InvalidCredentialsException.constructor) {
        throw error
      }
      // For unexpected errors, throw internal server error
      throw AuthErrors.AuthenticationServiceException
    }
  }

  login(user: any): { access_token: string; refresh_token: string } {
    const payload = {
      userId: user.id,
      roleId: user.role.id,
      roleName: user.role.name
    }

    const accessToken = this.jwtService.sign(payload, {
      secret: envConfig.ACCESS_TOKEN_SECRET,
      expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN,
      algorithm: 'HS256'
    })
    const refreshToken = this.jwtService.sign(
      { sub: user.id, email: user.email, uuid: uuidv4() },
      {
        secret: envConfig.REFRESH_TOKEN_SECRET,
        expiresIn: envConfig.REFRESH_TOKEN_EXPIRES_IN,
        algorithm: 'HS256'
      }
    )

    return {
      access_token: accessToken,
      refresh_token: refreshToken
    }
  }

  async refreshTokens(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: envConfig.REFRESH_TOKEN_SECRET
      })

      // Find user to ensure they are still active
      const user = await this.authRepo.findUserById(payload.sub)

      if (!user) {
        throw AuthErrors.UserNotFoundException
      }

      // Create new access token
      const newPayload = {
        userId: user.id,
        roleId: user.role.id,
        roleName: user.role.name
      }

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: envConfig.ACCESS_TOKEN_SECRET,
        expiresIn: envConfig.ACCESS_TOKEN_EXPIRES_IN,
        algorithm: 'HS256'
      })
      const newRefreshToken = this.jwtService.sign(
        { sub: user.id, email: user.email },
        {
          secret: envConfig.REFRESH_TOKEN_SECRET,
          expiresIn: envConfig.REFRESH_TOKEN_EXPIRES_IN,
          algorithm: 'HS256'
        }
      )

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken
      }
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw AuthErrors.TokenExpiredException
      }
      if (error.name === 'JsonWebTokenError') {
        throw AuthErrors.InvalidRefreshTokenException
      }
      // If it's one of our custom errors, re-throw it
      if (error instanceof AuthErrors.UserNotFoundException.constructor) {
        throw error
      }
      throw AuthErrors.AuthenticationServiceException
    }
  }

  async forgotPassword(email: string, magicLink: string): Promise<{ message: string }> {
    try {
      if (!email) {
        throw AuthErrors.MissingCredentialsException
      }

      // Find user by email (only active users)
      const user = await this.authRepo.findActiveUserByEmail(email)

      if (!user) {
        // Don't reveal whether user exists for security
        return { message: 'If the email exists, a reset link has been sent.' }
      }

      // Create JWT reset token
      const resetToken = this.jwtService.sign(
        { 
          userId: user.id, 
          email: user.email,
          type: 'password-reset',
          iat: Math.floor(Date.now() / 1000)
        },
        {
          secret: envConfig.RESET_PASSWORD_SECRET,
          expiresIn: '24h'
        }
      )
      
      // Send reset password email
      await this.nodemailerService.sendResetPasswordEmail(
        user.email,
        resetToken,
        magicLink,
        `${user.firstName} ${user.lastName}`
      )

      return { 
        message: 'If the email exists, a reset link has been sent.'
      }
    } catch (error) {
      // If it's our custom error, re-throw it
      if (error instanceof AuthErrors.MissingCredentialsException.constructor) {
        throw error
      }
      // For other errors, still return success message for security
      return { message: 'If the email exists, a reset link has been sent.' }
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      if (!token || !newPassword) {
        throw AuthErrors.MissingCredentialsException
      }

      // Verify JWT reset token
      const payload = this.jwtService.verify(token, {
        secret: envConfig.RESET_PASSWORD_SECRET
      })

      // Validate token type and information
      if (payload.type !== 'password-reset' || !payload.userId || !payload.email) {
        throw AuthErrors.InvalidTokenException
      }

      // Find user by email to ensure they still exist and are active
      const user = await this.authRepo.findActiveUserByEmail(payload.email)

      if (!user || user.id !== payload.userId) {
        throw AuthErrors.UserNotFoundException
      }

      // Hash new password
      const hashedPassword = await this.hashingService.hashPassword(newPassword)

      // Update user password
      await this.authRepo.updateUserPassword(user.id, hashedPassword)

      return { message: 'Password has been reset successfully.' }
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw AuthErrors.TokenExpiredException
      }
      if (error.name === 'JsonWebTokenError') {
        throw AuthErrors.InvalidTokenException
      }
      // If it's one of our custom errors, re-throw it
      if (error instanceof AuthErrors.MissingCredentialsException.constructor ||
          error instanceof AuthErrors.InvalidTokenException.constructor ||
          error instanceof AuthErrors.UserNotFoundException.constructor) {
        throw error
      }
      throw AuthErrors.AuthenticationServiceException
    }
  }
}

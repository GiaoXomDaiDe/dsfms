import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import express from 'express'
import {
  AuthPayloadDto,
  AuthResponse,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto
} from '~/routes/auth/auth.dto'
import { IsPublic } from '~/shared/decorators/auth.decorator'
import { AuthService } from './auth.service'
import { JwtGuard } from './guards/jwt.guard'
import { LocalGuard } from './guards/local.guard'
import * as AuthErrors from './auth.error'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @IsPublic()
  @UseGuards(LocalGuard)
  async login(@Body() authPayloadDto: AuthPayloadDto, @Req() req: express.Request): Promise<AuthResponse> {
    return this.authService.login(req.user)
  }

  @Post('refresh')
  @IsPublic()
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refreshTokens(refreshTokenDto.refresh_token)
  }

  @Get('status')
  @UseGuards(JwtGuard)
  status(@Req() req: express.Request) {
    return req.user
  }

  @Post('forgot-password')
  @IsPublic()
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email, forgotPasswordDto.magicLink)
  }

  @Post('reset-password')
  @IsPublic()
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    // Validate passwords match
    if (resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword) {
      throw AuthErrors.PasswordsDoNotMatchException
    }

    return this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword)
  }
}

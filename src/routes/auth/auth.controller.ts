import { Body, Controller, Post, UseGuards, Get, Req } from '@nestjs/common'
import { AuthPayloadDto, RefreshTokenDto, AuthResponse, RefreshResponse } from '~/dto/auth.dto'
import { AuthService } from './auth.service'
import { LocalGuard } from './guards/local.guard'
import express from 'express'
import { JwtGuard } from './guards/jwt.guard'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(LocalGuard)
  async login(@Body() authPayloadDto: AuthPayloadDto, @Req() req: express.Request): Promise<AuthResponse> {
    return this.authService.login(req.user)
  }

  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<RefreshResponse> {
    return this.authService.refreshTokens(refreshTokenDto.refresh_token)
  }

  @Get('status')
  @UseGuards(JwtGuard)
  status(@Req() req: express.Request) {
    return req.user
  }
}

import { Body, Controller, HttpException, Post, UseGuards, Get, Req } from '@nestjs/common';
import { AuthPayloadDto } from '~/dto/auth.dto';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import * as constant from '~/shared/constants/api/auth';
import { LocalGuard } from './guards/local.guard';
import express from 'express';
import { JwtGuard } from './guards/jwt.guard';


@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService){}
    
    @Post('login')
    @UseGuards(LocalGuard)
    async login(@Body() authPayloadDto: AuthPayloadDto, @Req() req: express.Request) {
        return req.user;
    }

    @Get('status')
    @UseGuards(JwtGuard)
    status(@Req() req: express.Request) {
        return req.user;
    }
}

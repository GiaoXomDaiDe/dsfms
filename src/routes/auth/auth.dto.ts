import { IsString, IsNotEmpty, IsEmail } from 'class-validator'

export class AuthPayloadDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @IsNotEmpty()
  password: string
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @IsNotEmpty()
  password: string
}

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @IsNotEmpty()
  password: string

  @IsString()
  @IsNotEmpty()
  fullName: string
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string
}

// Response DTOs
export interface AuthResponse {
  access_token: string
  refresh_token: string
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
}

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string

  @IsString()
  @IsNotEmpty()
  magicLink: string
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string

  @IsString()
  @IsNotEmpty()
  newPassword: string

  @IsString()
  @IsNotEmpty()
  confirmPassword: string
}

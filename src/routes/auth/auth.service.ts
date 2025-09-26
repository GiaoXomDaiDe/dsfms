import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuidv4 } from 'uuid'
import { AuthPayloadDto } from '~/dto/auth.dto'
import envConfig from '~/shared/config'
import * as statusConst from '~/shared/constants/auth.constant'
import { HashingService } from '~/shared/services/hashing.service'
import { PrismaService } from '~/shared/services/prisma.service'
import { NodemailerService } from '../email/nodemailer.service'

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService,
    private hashingService: HashingService,
    private nodemailerService: NodemailerService
  ) {}

  async validateUser({ email, password }: AuthPayloadDto) {
    const user = await this.prismaService.user.findFirst({
      where: {
        email: email,
        deletedAt: null,
        status: statusConst.STATUS_CONST.ACTIVE
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!user) {
      return null
    }

    const isPasswordValid = await this.hashingService.comparePassword(password, user.passwordHash)

    if (!isPasswordValid) {
      return null
    }

    // ko return password
    const { passwordHash, ...userWithoutPassword } = user
    return userWithoutPassword
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
      // Verify refresh token với correct secret
      const payload = this.jwtService.verify(refreshToken, {
        secret: envConfig.REFRESH_TOKEN_SECRET
      })

      // Tìm user từ database để đảm bảo user vẫn active
      const user = await this.prismaService.user.findFirst({
        where: {
          id: payload.sub,
          deletedAt: null,
          status: statusConst.STATUS_CONST.ACTIVE
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          department: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      if (!user) {
        throw new UnauthorizedException('User not found or inactive')
      }

      // Tạo access token mới
      const newPayload = {
        user_id: user.id,
        role_id: user.role.id,
        role_name: user.role.name
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
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async forgotPassword(email: string, magicLink: string): Promise<{ message: string }> {
    // Tìm user theo email
    const user = await this.prismaService.user.findFirst({
      where: {
        email: email,
        deletedAt: null,
        status: statusConst.STATUS_CONST.ACTIVE
      }
    })

    if (!user) {
      // Không tiết lộ user có tồn tại hay không vì security
      return { message: 'If the email exists, a reset link has been sent.' }
    }

    // Tạo JWT reset token thay vì lưu database
    const resetToken = this.jwtService.sign(
      { 
        userId: user.id, 
        email: user.email,
        type: 'password-reset',
        iat: Math.floor(Date.now() / 1000) // issued at time
      },
      {
        secret: envConfig.RESET_PASSWORD_SECRET,
        expiresIn: '24h' // Token hết hạn sau 24 giờ
      }
    )
    
    // Gửi email reset password
    await this.nodemailerService.sendResetPasswordEmail(
      user.email,
      resetToken,
      magicLink,
      `${user.firstName} ${user.lastName}`
    )

    return { 
      message: 'If the email exists, a reset link has been sent.'
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      // Verify JWT reset token
      const payload = this.jwtService.verify(token, {
        secret: envConfig.RESET_PASSWORD_SECRET
      })

      // Validate token type và thông tin
      if (payload.type !== 'password-reset' || !payload.userId || !payload.email) {
        throw new UnauthorizedException('Invalid reset token')
      }

      // Tìm user để đảm bảo vẫn tồn tại và active
      const user = await this.prismaService.user.findFirst({
        where: {
          id: payload.userId,
          email: payload.email,
          deletedAt: null,
          status: statusConst.STATUS_CONST.ACTIVE
        }
      })

      if (!user) {
        throw new UnauthorizedException('User not found or inactive')
      }

      // Hash password mới
      const hashedPassword = await this.hashingService.hashPassword(newPassword)

      // Update user password
      await this.prismaService.user.update({
        where: { id: user.id },
        data: { 
          passwordHash: hashedPassword,
          updatedAt: new Date()
        }
      })

      return { message: 'Password has been reset successfully.' }
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Reset token has expired')
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid reset token')
      }
      throw error // Re-throw other errors
    }
  }
}

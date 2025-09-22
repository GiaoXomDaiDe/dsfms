import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { v4 as uuidv4 } from 'uuid'
import { AuthPayloadDto } from '~/dto/auth.dto'
import envConfig from '~/shared/config'
import * as statusConst from '~/shared/constants/auth.constant'
import { HashingService } from '~/shared/services/hashing.service'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService,
    private hashingService: HashingService
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
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken)

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
}

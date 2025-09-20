import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prismaService: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'daylasecretkeysieudaihehe'
    })
  }

  async validate(payload: any) {
    // Kiểm tra user vẫn còn active trong database
    const user = await this.prismaService.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
        status: 'ACTIVE'
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

    // Trả về thông tin user để sử dụng trong controller
    return {
      id: user.id,
      eid: user.eid,
      email: user.email,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      role: user.role,
      department: user.department,
      avatarUrl: user.avatarUrl
    }
  }
}

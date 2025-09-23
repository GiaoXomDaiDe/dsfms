import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { HTTPMethod, REQUEST_ROLE_PERMISSIONS, REQUEST_USER_KEY } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'
import { TokenService } from '~/shared/services/token.service'
import { AccessTokenPayload } from '~/shared/types/jwt.types'

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prismaService: PrismaService
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    // Extract và validate access token
    const decodedAccessToken = await this.extractAndValidateToken(request)
    // Check user permission
    await this.validateUserPermission(decodedAccessToken, request)
    return true
  }

  private async extractAndValidateToken(request: any): Promise<AccessTokenPayload> {
    const accessToken = this.extractTokenFromHeader(request)
    try {
      const decodedAccessToken = await this.tokenService.verifyAccessToken(accessToken)
      request[REQUEST_USER_KEY] = decodedAccessToken

      return decodedAccessToken
    } catch {
      throw new UnauthorizedException('Invalid access token')
    }
  }

  private extractTokenFromHeader(request: any): string {
    const accessToken = request.headers.authorization?.split(' ')[1]
    if (!accessToken) {
      throw new UnauthorizedException('Access token is missing')
    }
    return accessToken
  }

  private async validateUserPermission(decodedAccessToken: AccessTokenPayload, request: any): Promise<void> {
    const roleId: string = decodedAccessToken.roleId
    const path: string = request.route.path
    const method = request.method as keyof typeof HTTPMethod
    const role = await this.prismaService.role
      .findUniqueOrThrow({
        where: {
          id: roleId,
          deletedAt: null,
          isActive: true
        },
        include: {
          permissions: {
            where: {
              deletedAt: null,
              path,
              method
            }
          }
        }
      })
      .catch(() => {
        throw new ForbiddenException()
      })
    const canAccess = role.permissions.length > 0
    if (!canAccess) {
      throw new ForbiddenException()
    }
    request[REQUEST_ROLE_PERMISSIONS] = role
  }
}

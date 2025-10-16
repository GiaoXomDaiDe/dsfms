import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from './auth.service'
import { AuthRepo } from './auth.repo'
import { HashingService } from '../../shared/services/hashing.service'
import { JwtService } from '@nestjs/jwt'
import { NodemailerService } from '../email/nodemailer.service'
import * as AuthErrors from './auth.error'
import * as statusConst from '~/shared/constants/auth.constant'

describe('AuthService', () => {
  let service: AuthService
  let authRepo: jest.Mocked<AuthRepo>
  let hashingService: jest.Mocked<HashingService>
  let jwtService: jest.Mocked<JwtService>
  let nodemailerService: jest.Mocked<NodemailerService>

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    status: statusConst.UserStatus.ACTIVE,
    deletedAt: null,
    role: {
      id: 'role-id',
      name: 'TRAINEE',
      description: 'Trainee role'
    },
    department: {
      id: 'dept-id',
      name: 'IT Department'
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepo,
          useValue: {
            findUserByEmail: jest.fn(),
            findActiveUserByEmail: jest.fn(),
            findUserById: jest.fn(),
            updateUserPassword: jest.fn()
          }
        },
        {
          provide: HashingService,
          useValue: {
            comparePassword: jest.fn(),
            hashPassword: jest.fn()
          }
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn()
          }
        },
        {
          provide: NodemailerService,
          useValue: {
            sendResetPasswordEmail: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<AuthService>(AuthService)
    authRepo = module.get(AuthRepo)
    hashingService = module.get(HashingService)
    jwtService = module.get(JwtService)
    nodemailerService = module.get(NodemailerService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('validateUser', () => {
    const authPayload = { email: 'test@example.com', password: 'password' }

    it('should throw MissingCredentialsException when email is missing', async () => {
      await expect(service.validateUser({ email: '', password: 'password' })).rejects.toThrow(
        AuthErrors.MissingCredentialsException
      )
    })

    it('should throw MissingCredentialsException when password is missing', async () => {
      await expect(service.validateUser({ email: 'test@example.com', password: '' })).rejects.toThrow(
        AuthErrors.MissingCredentialsException
      )
    })

    it('should throw UserNotFoundException when user does not exist', async () => {
      authRepo.findUserByEmail.mockResolvedValue(null)

      await expect(service.validateUser(authPayload)).rejects.toThrow(AuthErrors.UserNotFoundException)
    })

    it('should throw AccountDisabledException when user is disabled', async () => {
      const disabledUser = { ...mockUser, status: statusConst.UserStatus.DISABLED }
      authRepo.findUserByEmail.mockResolvedValue(disabledUser)

      await expect(service.validateUser(authPayload)).rejects.toThrow(AuthErrors.AccountDisabledException)
    })

    it('should throw InvalidCredentialsException when password is invalid', async () => {
      authRepo.findUserByEmail.mockResolvedValue(mockUser)
      hashingService.comparePassword.mockResolvedValue(false)

      await expect(service.validateUser(authPayload)).rejects.toThrow(AuthErrors.InvalidCredentialsException)
    })

    it('should return user without password when credentials are valid', async () => {
      authRepo.findUserByEmail.mockResolvedValue(mockUser)
      hashingService.comparePassword.mockResolvedValue(true)

      const result = await service.validateUser(authPayload)

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        status: mockUser.status,
        deletedAt: mockUser.deletedAt,
        role: mockUser.role,
        department: mockUser.department
      })
      expect(result).not.toHaveProperty('passwordHash')
    })

    it('should throw AuthenticationServiceException on unexpected error', async () => {
      authRepo.findUserByEmail.mockRejectedValue(new Error('Database error'))

      await expect(service.validateUser(authPayload)).rejects.toThrow(AuthErrors.AuthenticationServiceException)
    })
  })

  describe('login', () => {
    it('should return access and refresh tokens', () => {
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      }
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token')

      const result = service.login(mockUser)

      expect(result).toEqual(mockTokens)
      expect(jwtService.sign).toHaveBeenCalledTimes(2)
    })
  })

  describe('refreshTokens', () => {
    const refreshToken = 'valid-refresh-token'
    const payload = { sub: 'user-id', email: 'test@example.com' }

    it('should return new tokens when refresh token is valid', async () => {
      jwtService.verify.mockReturnValue(payload)
      authRepo.findUserById.mockResolvedValue(mockUser)
      jwtService.sign.mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token')

      const result = await service.refreshTokens(refreshToken)

      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      })
    })

    it('should throw UserNotFoundException when user not found', async () => {
      jwtService.verify.mockReturnValue(payload)
      authRepo.findUserById.mockResolvedValue(null)

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(AuthErrors.UserNotFoundException)
    })

    it('should throw TokenExpiredException when token is expired', async () => {
      const expiredError = new Error('Token expired')
      expiredError.name = 'TokenExpiredError'
      jwtService.verify.mockImplementation(() => {
        throw expiredError
      })

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(AuthErrors.TokenExpiredException)
    })

    it('should throw InvalidRefreshTokenException for invalid token', async () => {
      const invalidError = new Error('Invalid token')
      invalidError.name = 'JsonWebTokenError'
      jwtService.verify.mockImplementation(() => {
        throw invalidError
      })

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(AuthErrors.InvalidRefreshTokenException)
    })
  })

  describe('forgotPassword', () => {
    const email = 'test@example.com'
    const magicLink = 'http://example.com/reset'

    it('should throw MissingCredentialsException when email is missing', async () => {
      await expect(service.forgotPassword('', magicLink)).rejects.toThrow(AuthErrors.MissingCredentialsException)
    })

    it('should return success message when user exists', async () => {
      authRepo.findActiveUserByEmail.mockResolvedValue(mockUser)
      jwtService.sign.mockReturnValue('reset-token')
      nodemailerService.sendResetPasswordEmail.mockResolvedValue({ success: true, message: 'Email sent' })

      const result = await service.forgotPassword(email, magicLink)

      expect(result.message).toBe('If the email exists, a reset link has been sent.')
      expect(nodemailerService.sendResetPasswordEmail).toHaveBeenCalled()
    })

    it('should return success message even when user does not exist (security)', async () => {
      authRepo.findActiveUserByEmail.mockResolvedValue(null)

      const result = await service.forgotPassword(email, magicLink)

      expect(result.message).toBe('If the email exists, a reset link has been sent.')
      expect(nodemailerService.sendResetPasswordEmail).not.toHaveBeenCalled()
    })
  })

  describe('resetPassword', () => {
    const token = 'valid-reset-token'
    const newPassword = 'newPassword123'
    const payload = {
      userId: 'user-id',
      email: 'test@example.com',
      type: 'password-reset'
    }

    it('should throw MissingCredentialsException when token is missing', async () => {
      await expect(service.resetPassword('', newPassword)).rejects.toThrow(AuthErrors.MissingCredentialsException)
    })

    it('should throw MissingCredentialsException when password is missing', async () => {
      await expect(service.resetPassword(token, '')).rejects.toThrow(AuthErrors.MissingCredentialsException)
    })

    it('should successfully reset password with valid token', async () => {
      jwtService.verify.mockReturnValue(payload)
      authRepo.findActiveUserByEmail.mockResolvedValue(mockUser)
      hashingService.hashPassword.mockResolvedValue('new-hashed-password')
      authRepo.updateUserPassword.mockResolvedValue(undefined)

      const result = await service.resetPassword(token, newPassword)

      expect(result.message).toBe('Password has been reset successfully.')
      expect(authRepo.updateUserPassword).toHaveBeenCalledWith(mockUser.id, 'new-hashed-password')
    })

    it('should throw InvalidTokenException for invalid token type', async () => {
      const invalidPayload = { ...payload, type: 'invalid-type' }
      jwtService.verify.mockReturnValue(invalidPayload)

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(AuthErrors.InvalidTokenException)
    })

    it('should throw TokenExpiredException when token is expired', async () => {
      const expiredError = new Error('Token expired')
      expiredError.name = 'TokenExpiredError'
      jwtService.verify.mockImplementation(() => {
        throw expiredError
      })

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(AuthErrors.TokenExpiredException)
    })
  })
})

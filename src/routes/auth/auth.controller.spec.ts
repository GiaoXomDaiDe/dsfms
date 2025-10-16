import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import * as AuthErrors from './auth.error'

describe('AuthController', () => {
  let controller: AuthController
  let authService: jest.Mocked<AuthService>

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: { id: 'role-id', name: 'TRAINEE' }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            refreshTokens: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn()
          }
        }
      ]
    }).compile()

    controller = module.get<AuthController>(AuthController)
    authService = module.get(AuthService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('login', () => {
    it('should return auth response with tokens', async () => {
      const expectedResponse = {
        access_token: 'access-token',
        refresh_token: 'refresh-token'
      }
      authService.login.mockReturnValue(expectedResponse)

      const mockRequest = { user: mockUser } as any
      const result = await controller.login({} as any, mockRequest)

      expect(result).toEqual(expectedResponse)
      expect(authService.login).toHaveBeenCalledWith(mockUser)
    })
  })

  describe('refresh', () => {
    it('should return new tokens', async () => {
      const refreshTokenDto = { refresh_token: 'refresh-token' }
      const expectedResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
      }
      authService.refreshTokens.mockResolvedValue(expectedResponse)

      const result = await controller.refresh(refreshTokenDto)

      expect(result).toEqual(expectedResponse)
      expect(authService.refreshTokens).toHaveBeenCalledWith('refresh-token')
    })
  })

  describe('status', () => {
    it('should return user from request', () => {
      const mockRequest = { user: mockUser } as any
      const result = controller.status(mockRequest)

      expect(result).toEqual(mockUser)
    })
  })

  describe('forgotPassword', () => {
    it('should return success message', async () => {
      const forgotPasswordDto = {
        email: 'test@example.com',
        magicLink: 'http://example.com/reset'
      }
      const expectedResponse = {
        message: 'If the email exists, a reset link has been sent.'
      }
      authService.forgotPassword.mockResolvedValue(expectedResponse)

      const result = await controller.forgotPassword(forgotPasswordDto)

      expect(result).toEqual(expectedResponse)
      expect(authService.forgotPassword).toHaveBeenCalledWith('test@example.com', 'http://example.com/reset')
    })
  })

  describe('resetPassword', () => {
    it('should throw PasswordsDoNotMatchException when passwords do not match', async () => {
      const resetPasswordDto = {
        token: 'reset-token',
        newPassword: 'newPassword123',
        confirmPassword: 'differentPassword'
      }

      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow(AuthErrors.PasswordsDoNotMatchException)

      expect(authService.resetPassword).not.toHaveBeenCalled()
    })

    it('should return success message when passwords match', async () => {
      const resetPasswordDto = {
        token: 'reset-token',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123'
      }
      const expectedResponse = {
        message: 'Password has been reset successfully.'
      }
      authService.resetPassword.mockResolvedValue(expectedResponse)

      const result = await controller.resetPassword(resetPasswordDto)

      expect(result).toEqual(expectedResponse)
      expect(authService.resetPassword).toHaveBeenCalledWith('reset-token', 'newPassword123')
    })
  })
})

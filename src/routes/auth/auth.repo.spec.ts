import { Test, TestingModule } from '@nestjs/testing';
import { AuthRepo } from './auth.repo';
import { PrismaService } from '../../shared/services/prisma.service';
import * as statusConst from '~/shared/constants/auth.constant';

describe('AuthRepo', () => {
  let repo: AuthRepo;
  let mockPrismaService: any;

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
      description: 'Trainee role',
    },
    department: {
      id: 'dept-id',
      name: 'IT Department',
    },
  };

  beforeEach(async () => {
    mockPrismaService = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthRepo,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repo = module.get<AuthRepo>(AuthRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  describe('findUserByEmail', () => {
    it('should return user when found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await repo.findUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          deletedAt: null,
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await repo.findUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findActiveUserByEmail', () => {
    it('should return active user when found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await repo.findActiveUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          deletedAt: null,
          status: statusConst.UserStatus.ACTIVE,
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should return null when user not found or not active', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await repo.findActiveUserByEmail('test@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findUserById', () => {
    it('should return user when found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await repo.findUserById('user-id');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'user-id',
          deletedAt: null,
          status: statusConst.UserStatus.ACTIVE,
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const result = await repo.findUserById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateUserPassword', () => {
    it('should update user password', async () => {
      const updatedUser = { ...mockUser, passwordHash: 'new-hashed-password' };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      await repo.updateUserPassword('user-id', 'new-hashed-password');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          passwordHash: 'new-hashed-password',
          updatedAt: expect.any(Date),
        },
      });
    });
  });
});
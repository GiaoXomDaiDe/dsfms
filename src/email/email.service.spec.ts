import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SendEmailDto, BulkEmailDto } from '~/dto/email.dto';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-ses');
const mockSESClient = jest.mocked(SESClient);
const mockSend = jest.fn();

describe('EmailService', () => {
  let service: EmailService;
  let configService: ConfigService;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    mockSend.mockReset();

    // Setup SES client mock
    mockSESClient.mockImplementation(() => ({
      send: mockSend,
    } as any));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'AWS_REGION': 'us-east-1',
                'AWS_ACCESS_KEY_ID': 'test-access-key',
                'AWS_SECRET_ACCESS_KEY': 'test-secret-key',
                'SES_FROM_EMAIL': 'test@example.com',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw error if AWS credentials are missing', async () => {
      const module = Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      });

      await expect(module.compile()).rejects.toThrow(
        'AWS credentials are required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY'
      );
    });
  });

  describe('sendEmail', () => {
    const mockEmailDto: SendEmailDto = {
      to: 'recipient@example.com',
      subject: 'Test Subject',
      htmlBody: '<h1>Test HTML</h1>',
    };

    it('should send email successfully with HTML body', async () => {
      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.sendEmail(mockEmailDto);

      expect(result).toEqual({ messageId: 'test-message-id' });
      expect(mockSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });

    it('should send email successfully with text body', async () => {
      const emailDto: SendEmailDto = {
        ...mockEmailDto,
        textBody: 'Test text content',
        htmlBody: undefined,
      };
      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.sendEmail(emailDto);

      expect(result).toEqual({ messageId: 'test-message-id' });
      expect(mockSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });

    it('should send email with CC and BCC recipients', async () => {
      const emailDto: SendEmailDto = {
        ...mockEmailDto,
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
      };
      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.sendEmail(emailDto);

      expect(result).toEqual({ messageId: 'test-message-id' });
      expect(mockSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });

    it('should use custom from email when provided', async () => {
      const emailDto: SendEmailDto = {
        ...mockEmailDto,
        from: 'custom@example.com',
      };
      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      await service.sendEmail(emailDto);

      expect(mockSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });

    it('should throw BadRequestException if neither textBody nor htmlBody provided', async () => {
      const emailDto: SendEmailDto = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
      };

      await expect(service.sendEmail(emailDto)).rejects.toThrow(
        new BadRequestException('Failed to send email: Either textBody or htmlBody must be provided')
      );
    });

    it('should handle SES errors and throw BadRequestException', async () => {
      const mockError = new Error('SES Error');
      mockSend.mockRejectedValue(mockError);

      await expect(service.sendEmail(mockEmailDto)).rejects.toThrow(
        new BadRequestException('Failed to send email: SES Error')
      );
    });

    it('should return unknown messageId if SES response has no MessageId', async () => {
      const mockResponse = { MessageId: undefined };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.sendEmail(mockEmailDto);

      expect(result).toEqual({ messageId: 'unknown' });
    });
  });

  describe('bulkEmailSending', () => {
    it('should send emails to multiple recipients successfully', async () => {
      const recipients = ['user1@example.com', 'user2@example.com'];
      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.bulkEmailSending(recipients);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.messageIds).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in bulk sending', async () => {
      const recipients = ['user1@example.com', 'user2@example.com'];
      mockSend
        .mockResolvedValueOnce({ MessageId: 'success-id' })
        .mockRejectedValueOnce(new Error('SES Error'));

      const result = await service.bulkEmailSending(recipients);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.messageIds).toHaveLength(1);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should handle large recipient lists in batches', async () => {
      const recipients = Array.from({ length: 25 }, (_, i) => `user${i}@example.com`);
      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.bulkEmailSending(recipients);

      expect(result.success).toBe(25);
      expect(result.failed).toBe(0);
      expect(result.messageIds).toHaveLength(25);
      expect(mockSend).toHaveBeenCalledTimes(25);
    });
  });

  describe('sendBulkEmail', () => {
    const mockBulkEmailDto: BulkEmailDto = {
      recipients: ['user1@example.com', 'user2@example.com'],
      subject: 'Bulk Test Subject',
      htmlBody: '<h1>Bulk Test HTML</h1>',
    };

    it('should send bulk emails successfully', async () => {
      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.sendBulkEmail(mockBulkEmailDto);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.messageIds).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if neither textBody nor htmlBody provided', async () => {
      const bulkEmailDto: BulkEmailDto = {
        recipients: ['user1@example.com'],
        subject: 'Test Subject',
      };

      await expect(service.sendBulkEmail(bulkEmailDto)).rejects.toThrow(
        new BadRequestException('Either textBody or htmlBody must be provided')
      );
    });

    it('should handle failures in bulk email sending', async () => {
      mockSend
        .mockResolvedValueOnce({ MessageId: 'success-id' })
        .mockRejectedValueOnce(new Error('SES Error'));

      const result = await service.sendBulkEmail(mockBulkEmailDto);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.messageIds).toHaveLength(1);
    });

    it('should send bulk emails with custom from address', async () => {
      const bulkEmailDto: BulkEmailDto = {
        ...mockBulkEmailDto,
        from: 'custom@example.com',
      };
      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.sendBulkEmail(bulkEmailDto);

      expect(result.success).toBe(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});

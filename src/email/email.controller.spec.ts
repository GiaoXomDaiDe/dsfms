import { Test, TestingModule } from '@nestjs/testing';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { SendEmailDto, BulkEmailDto } from '~/dto/email.dto';

describe('EmailController', () => {
  let controller: EmailController;
  let emailService: EmailService;

  const mockEmailService = {
    sendEmail: jest.fn(),
    sendBulkEmail: jest.fn(),
    bulkEmailSending: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    controller = module.get<EmailController>(EmailController);
    emailService = module.get<EmailService>(EmailService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should send a single email successfully', async () => {
      const sendEmailDto: SendEmailDto = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        htmlBody: '<h1>Test HTML</h1>',
      };

      const expectedResult = { messageId: 'test-message-id' };
      mockEmailService.sendEmail.mockResolvedValue(expectedResult);

      const result = await controller.sendEmail(sendEmailDto);

      expect(emailService.sendEmail).toHaveBeenCalledWith(sendEmailDto);
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should send email with text body', async () => {
      const sendEmailDto: SendEmailDto = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        textBody: 'Test text content',
      };

      const expectedResult = { messageId: 'test-message-id-2' };
      mockEmailService.sendEmail.mockResolvedValue(expectedResult);

      const result = await controller.sendEmail(sendEmailDto);

      expect(emailService.sendEmail).toHaveBeenCalledWith(sendEmailDto);
      expect(result).toEqual(expectedResult);
    });

    it('should send email with CC and BCC recipients', async () => {
      const sendEmailDto: SendEmailDto = {
        to: 'recipient@example.com',
        cc: ['cc1@example.com', 'cc2@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        htmlBody: '<h1>Test HTML</h1>',
      };

      const expectedResult = { messageId: 'test-message-id-3' };
      mockEmailService.sendEmail.mockResolvedValue(expectedResult);

      const result = await controller.sendEmail(sendEmailDto);

      expect(emailService.sendEmail).toHaveBeenCalledWith(sendEmailDto);
      expect(result).toEqual(expectedResult);
    });

    it('should send email with custom from and replyTo', async () => {
      const sendEmailDto: SendEmailDto = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        htmlBody: '<h1>Test HTML</h1>',
        from: 'custom@example.com',
        replyTo: 'reply@example.com',
      };

      const expectedResult = { messageId: 'test-message-id-4' };
      mockEmailService.sendEmail.mockResolvedValue(expectedResult);

      const result = await controller.sendEmail(sendEmailDto);

      expect(emailService.sendEmail).toHaveBeenCalledWith(sendEmailDto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle email service errors', async () => {
      const sendEmailDto: SendEmailDto = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        htmlBody: '<h1>Test HTML</h1>',
      };

      const errorMessage = 'Failed to send email';
      mockEmailService.sendEmail.mockRejectedValue(new Error(errorMessage));

      await expect(controller.sendEmail(sendEmailDto)).rejects.toThrow(errorMessage);
      expect(emailService.sendEmail).toHaveBeenCalledWith(sendEmailDto);
    });
  });

  describe('sendBulkEmail', () => {
    it('should send bulk emails successfully', async () => {
      const bulkEmailDto: BulkEmailDto = {
        recipients: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
        subject: 'Bulk Test Subject',
        htmlBody: '<h1>Bulk Test HTML</h1>',
      };

      const expectedResult = {
        success: 3,
        failed: 0,
        messageIds: ['id1', 'id2', 'id3'],
      };
      mockEmailService.sendBulkEmail.mockResolvedValue(expectedResult);

      const result = await controller.sendBulkEmail(bulkEmailDto);

      expect(emailService.sendBulkEmail).toHaveBeenCalledWith(bulkEmailDto);
      expect(emailService.sendBulkEmail).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should send bulk emails with text body', async () => {
      const bulkEmailDto: BulkEmailDto = {
        recipients: ['user1@example.com', 'user2@example.com'],
        subject: 'Bulk Test Subject',
        textBody: 'Bulk test text content',
      };

      const expectedResult = {
        success: 2,
        failed: 0,
        messageIds: ['id1', 'id2'],
      };
      mockEmailService.sendBulkEmail.mockResolvedValue(expectedResult);

      const result = await controller.sendBulkEmail(bulkEmailDto);

      expect(emailService.sendBulkEmail).toHaveBeenCalledWith(bulkEmailDto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle partial failures in bulk sending', async () => {
      const bulkEmailDto: BulkEmailDto = {
        recipients: ['user1@example.com', 'user2@example.com', 'invalid-email'],
        subject: 'Bulk Test Subject',
        htmlBody: '<h1>Bulk Test HTML</h1>',
      };

      const expectedResult = {
        success: 2,
        failed: 1,
        messageIds: ['id1', 'id2'],
      };
      mockEmailService.sendBulkEmail.mockResolvedValue(expectedResult);

      const result = await controller.sendBulkEmail(bulkEmailDto);

      expect(emailService.sendBulkEmail).toHaveBeenCalledWith(bulkEmailDto);
      expect(result).toEqual(expectedResult);
    });

    it('should send bulk emails with custom from address', async () => {
      const bulkEmailDto: BulkEmailDto = {
        recipients: ['user1@example.com', 'user2@example.com'],
        subject: 'Bulk Test Subject',
        htmlBody: '<h1>Bulk Test HTML</h1>',
        from: 'custom@example.com',
      };

      const expectedResult = {
        success: 2,
        failed: 0,
        messageIds: ['id1', 'id2'],
      };
      mockEmailService.sendBulkEmail.mockResolvedValue(expectedResult);

      const result = await controller.sendBulkEmail(bulkEmailDto);

      expect(emailService.sendBulkEmail).toHaveBeenCalledWith(bulkEmailDto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle bulk email service errors', async () => {
      const bulkEmailDto: BulkEmailDto = {
        recipients: ['user1@example.com'],
        subject: 'Bulk Test Subject',
        htmlBody: '<h1>Bulk Test HTML</h1>',
      };

      const errorMessage = 'Failed to send bulk emails';
      mockEmailService.sendBulkEmail.mockRejectedValue(new Error(errorMessage));

      await expect(controller.sendBulkEmail(bulkEmailDto)).rejects.toThrow(errorMessage);
      expect(emailService.sendBulkEmail).toHaveBeenCalledWith(bulkEmailDto);
    });
  });

  describe('bulkEmailSending', () => {
    it('should send bulk emails using simple recipients array', async () => {
      const body = {
        recipients: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
      };

      const expectedResult = {
        success: 3,
        failed: 0,
        messageIds: ['id1', 'id2', 'id3'],
      };
      mockEmailService.bulkEmailSending.mockResolvedValue(expectedResult);

      const result = await controller.bulkEmailSending(body);

      expect(emailService.bulkEmailSending).toHaveBeenCalledWith(body.recipients);
      expect(emailService.bulkEmailSending).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty recipients array', async () => {
      const body = {
        recipients: [],
      };

      const expectedResult = {
        success: 0,
        failed: 0,
        messageIds: [],
      };
      mockEmailService.bulkEmailSending.mockResolvedValue(expectedResult);

      const result = await controller.bulkEmailSending(body);

      expect(emailService.bulkEmailSending).toHaveBeenCalledWith([]);
      expect(result).toEqual(expectedResult);
    });

    it('should handle large recipients array', async () => {
      const recipients = Array.from({ length: 100 }, (_, i) => `user${i}@example.com`);
      const body = { recipients };

      const expectedResult = {
        success: 95,
        failed: 5,
        messageIds: Array.from({ length: 95 }, (_, i) => `id${i}`),
      };
      mockEmailService.bulkEmailSending.mockResolvedValue(expectedResult);

      const result = await controller.bulkEmailSending(body);

      expect(emailService.bulkEmailSending).toHaveBeenCalledWith(recipients);
      expect(result).toEqual(expectedResult);
    });

    it('should handle bulk email sending service errors', async () => {
      const body = {
        recipients: ['user1@example.com'],
      };

      const errorMessage = 'Failed to send bulk emails';
      mockEmailService.bulkEmailSending.mockRejectedValue(new Error(errorMessage));

      await expect(controller.bulkEmailSending(body)).rejects.toThrow(errorMessage);
      expect(emailService.bulkEmailSending).toHaveBeenCalledWith(body.recipients);
    });

    it('should handle partial failures in simple bulk sending', async () => {
      const body = {
        recipients: ['user1@example.com', 'invalid-email', 'user3@example.com'],
      };

      const expectedResult = {
        success: 2,
        failed: 1,
        messageIds: ['id1', 'id3'],
      };
      mockEmailService.bulkEmailSending.mockResolvedValue(expectedResult);

      const result = await controller.bulkEmailSending(body);

      expect(emailService.bulkEmailSending).toHaveBeenCalledWith(body.recipients);
      expect(result).toEqual(expectedResult);
    });
  });
});

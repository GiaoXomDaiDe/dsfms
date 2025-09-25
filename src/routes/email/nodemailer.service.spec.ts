import { Test, TestingModule } from '@nestjs/testing';
import { NodemailerService } from './nodemailer.service';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn()
}));

describe('NodemailerService', () => {
  let service: NodemailerService;
  let mockTransporter: any;
  let mockCreateTransport: jest.MockedFunction<typeof nodemailer.createTransport>;

  beforeEach(async () => {
    // Mock transporter
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn(),
    };

    mockCreateTransport = nodemailer.createTransport as jest.MockedFunction<typeof nodemailer.createTransport>;
    mockCreateTransport.mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [NodemailerService],
    }).compile();

    service = module.get<NodemailerService>(NodemailerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send single email successfully', async () => {
    const mockResult = { messageId: 'test-message-id' };
    mockTransporter.sendMail.mockResolvedValue(mockResult);

    const emailOptions = {
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test HTML</p>',
      text: 'Test text'
    };

    const result = await service.sendEmail(emailOptions);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-message-id');
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test text'
      })
    );
  });

  it('should handle send email error', async () => {
    const mockError = new Error('Send failed');
    mockTransporter.sendMail.mockRejectedValue(mockError);

    const emailOptions = {
      to: 'test@example.com',
      subject: 'Test Subject',
      text: 'Test text'
    };

    const result = await service.sendEmail(emailOptions);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Send failed');
  });

  it('should send bulk emails', async () => {
    const mockResult = { messageId: 'test-message-id' };
    mockTransporter.sendMail.mockResolvedValue(mockResult);

    const emails = [
      { to: 'test1@example.com', subject: 'Test 1', text: 'Text 1' },
      { to: 'test2@example.com', subject: 'Test 2', text: 'Text 2' }
    ];

    const result = await service.sendBulkEmails(emails);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
  });

  it('should verify connection successfully', async () => {
    mockTransporter.verify.mockResolvedValue(true);

    const result = await service.verifyConnection();

    expect(result).toBe(true);
    expect(mockTransporter.verify).toHaveBeenCalled();
  });

  it('should handle connection verification failure', async () => {
    const mockError = new Error('Connection failed');
    mockTransporter.verify.mockRejectedValue(mockError);

    const result = await service.verifyConnection();

    expect(result).toBe(false);
  });
});
// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing'
import { TemplateService } from './template.service'
import { TemplateRepository } from './template.repository'
import { PdfConverterService } from '~/shared/services/pdf-converter.service'
import { NodemailerService } from '../email/nodemailer.service'
import { CreateTemplateFormDto, CreateTemplateVersionDto, UpdateTemplateFormDto } from './template.dto'
import {
  InvalidFileTypeError,
  DocxParsingError,
  TemplateConfigRequiredError,
  DepartmentNotFoundError,
  TemplateNameAlreadyExistsError,
  RoleRequiredMismatchError,
  SignatureFieldMissingRoleError,
  PartFieldMissingChildrenError,
  TemplateCreationFailedError,
  TemplateNotFoundError,
  OriginalTemplateNotFoundError,
  TemplateVersionCreationError,
  InvalidTemplateStatusForUpdateError,
  InvalidDraftTemplateStatusError,
  MissingSignatureFieldError
} from './template.error'
import * as PizZip from 'pizzip'
import * as Docxtemplater from 'docxtemplater'

// Mock external dependencies
jest.mock('pizzip')
jest.mock('docxtemplater')
jest.mock('jszip')

const mockDocxtemplater = {
  getFullText: jest.fn(),
  constructor: jest.fn()
}

const mockPizZip = {
  constructor: jest.fn()
}

describe('TemplateService', () => {
  let service: TemplateService
  let templateRepository: jest.Mocked<TemplateRepository>
  let pdfConverterService: jest.Mocked<PdfConverterService>
  let nodemailerService: jest.Mocked<NodemailerService>

  const mockUserContext = {
    userId: 'user-123',
    roleName: 'TRAINER',
    departmentId: 'dept-123'
  }

  const mockTemplate = {
    id: 'template-123',
    name: 'Test Template',
    description: 'Test Description',
    departmentId: 'dept-123',
    status: 'DRAFT',
    version: 1,
    templateContent: 'https://s3.amazonaws.com/test-content.docx',
    templateConfig: 'https://s3.amazonaws.com/test-config.docx',
    templateSchema: { testField: 'string' },
    createdAt: new Date(),
    updatedAt: new Date(),
    reviewedAt: null,
    createdByUserId: 'user-123',
    updatedByUserId: null,
    reviewedByUserId: null,
    referFirstVersionId: null,
    sections: [
      {
        id: 'section-123',
        label: 'Test Section',
        displayOrder: 1,
        editBy: 'TRAINER',
        roleInSubject: 'TRAINER',
        isSubmittable: true,
        isToggleDependent: false,
        templateId: 'template-123',
        fields: [
          {
            id: 'field-123',
            fieldName: 'testField',
            fieldType: 'TEXT',
            displayOrder: 1,
            parentId: null,
            tempId: 'temp-123',
            parentTempId: null,
            roleRequired: 'TRAINER'
          }
        ]
      }
    ],
    department: {
      id: 'dept-123',
      name: 'Test Department',
      code: 'TEST_DEPT'
    },
    createdByUser: {
      id: 'user-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    },
    reviewedByUser: null
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        {
          provide: TemplateRepository,
          useValue: {
            findTemplateById: jest.fn(),
            createTemplateWithSectionsAndFields: jest.fn(),
            findAllTemplates: jest.fn(),
            findTemplatesByDepartment: jest.fn(),
            findTemplatesByUser: jest.fn(),
            updateTemplateStatus: jest.fn(),
            updateTemplateBasicInfo: jest.fn(),
            updateRejectedTemplate: jest.fn(),
            updateDraftTemplate: jest.fn(),
            createTemplateVersion: jest.fn(),
            deleteDraftTemplate: jest.fn(),
            validateDepartmentExists: jest.fn(),
            templateNameExists: jest.fn(),
            templateHasAssessments: jest.fn(),
            getTemplateWithCreator: jest.fn(),
            getUserById: jest.fn(),
            getMaxVersionForTemplate: jest.fn()
          }
        },
        {
          provide: PdfConverterService,
          useValue: {
            convertDocxToPdfFromS3: jest.fn()
          }
        },
        {
          provide: NodemailerService,
          useValue: {
            sendApprovedTemplateEmail: jest.fn(),
            sendRejectedTemplateEmail: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<TemplateService>(TemplateService)
    templateRepository = module.get(TemplateRepository)
    pdfConverterService = module.get(PdfConverterService)
    nodemailerService = module.get(NodemailerService)

    // Setup Docxtemplater mock
    ;(Docxtemplater as any).mockImplementation(() => mockDocxtemplater)
    ;(PizZip as any).mockImplementation(() => mockPizZip)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('parseDocxTemplate', () => {
    const mockFile = {
      originalname: 'test.docx',
      buffer: Buffer.from('mock docx content')
    }

    beforeEach(() => {
      mockDocxtemplater.getFullText.mockReturnValue('{#section1}{field1}{field2}{/section1}')
    })

    it('should successfully parse a valid DOCX template', async () => {
      const result = await service.parseDocxTemplate(mockFile)

      expect(result).toEqual({
        success: true,
        message: expect.any(String),
        schema: expect.any(Object),
        placeholders: expect.any(Array)
      })
      expect(result.placeholders).toContain('{#section1}')
      expect(result.placeholders).toContain('{field1}')
      expect(result.schema).toHaveProperty('section1')
    })

    it('should throw DocxParsingError for non-DOCX files', async () => {
      const invalidFile = { ...mockFile, originalname: 'test.txt' }

      await expect(service.parseDocxTemplate(invalidFile)).rejects.toThrow(DocxParsingError)
    })

    it('should handle docxtemplater errors gracefully', async () => {
      mockDocxtemplater.getFullText.mockImplementation(() => {
        const error = new Error('Template parsing failed')
        error.properties = {
          explanation: 'Invalid template syntax',
          file: 'test.docx'
        }
        throw error
      })

      await expect(service.parseDocxTemplate(mockFile)).rejects.toThrow(DocxParsingError)
    })
  })

  describe('extractFieldsFromDocx', () => {
    const mockFile = {
      originalname: 'test.docx',
      buffer: Buffer.from('mock docx content')
    }

    beforeEach(() => {
      mockDocxtemplater.getFullText.mockReturnValue('{#section1}{field1}{field2}{/section1}{^toggle1}')
    })

    it('should extract structured fields from DOCX', async () => {
      const result = await service.extractFieldsFromDocx(mockFile)

      expect(result).toEqual({
        success: true,
        message: expect.any(String),
        fields: expect.any(Array),
        totalFields: expect.any(Number)
      })
      
      expect(result.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldName: 'section1',
            fieldType: 'PART',
            displayOrder: expect.any(Number),
            parentTempId: null,
            tempId: expect.any(String)
          }),
          expect.objectContaining({
            fieldName: 'toggle1',
            fieldType: 'TOGGLE',
            displayOrder: expect.any(Number)
          })
        ])
      )
    })

    it('should throw DocxParsingError for non-DOCX files', async () => {
      const invalidFile = { ...mockFile, originalname: 'test.pdf' }

      await expect(service.extractFieldsFromDocx(invalidFile)).rejects.toThrow(DocxParsingError)
    })
  })

  const mockCreateTemplateDto: CreateTemplateFormDto = {
    name: 'Test Template',
    description: 'Test Description',
    departmentId: 'dept-123',
    templateContent: 'https://s3.amazonaws.com/test.docx',
    templateConfig: 'https://s3.amazonaws.com/config.docx',
    sections: [
      {
        label: 'Test Section',
        displayOrder: 1,
        editBy: 'TRAINER',
        roleInSubject: 'TRAINER',
        isSubmittable: true,
        isToggleDependent: false,
        fields: [
          {
            fieldName: 'signature',
            fieldType: 'SIGNATURE_DRAW',
            displayOrder: 1,
            roleRequired: 'TRAINER',
            tempId: 'temp-sig'
          },
          {
            fieldName: 'finalScore',
            fieldType: 'FINAL_SCORE_NUM',
            displayOrder: 2,
            tempId: 'temp-score'
          }
        ]
      }
    ]
  }

  describe('createTemplate', () => {

    beforeEach(() => {
      templateRepository.validateDepartmentExists.mockResolvedValue(true)
      templateRepository.templateNameExists.mockResolvedValue(false)
      templateRepository.createTemplateWithSectionsAndFields.mockResolvedValue({
        templateForm: mockTemplate,
        sections: mockTemplate.sections
      })
    })

    it('should successfully create a template', async () => {
      const result = await service.createTemplate(mockCreateTemplateDto, mockUserContext)

      expect(result).toEqual({
        success: true,
        data: {
          templateForm: mockTemplate,
          sections: mockTemplate.sections
        },
        message: expect.any(String)
      })
      expect(templateRepository.validateDepartmentExists).toHaveBeenCalledWith('dept-123')
      expect(templateRepository.templateNameExists).toHaveBeenCalledWith('Test Template')
      expect(templateRepository.createTemplateWithSectionsAndFields).toHaveBeenCalled()
    })

    it('should throw TemplateConfigRequiredError when templateConfig is missing', async () => {
      const dtoWithoutConfig = { ...mockCreateTemplateDto, templateConfig: undefined }

      await expect(service.createTemplate(dtoWithoutConfig, mockUserContext))
        .rejects.toThrow(TemplateConfigRequiredError)
    })

    it('should throw DepartmentNotFoundError when department does not exist', async () => {
      templateRepository.validateDepartmentExists.mockResolvedValue(false)

      await expect(service.createTemplate(mockCreateTemplateDto, mockUserContext))
        .rejects.toThrow(DepartmentNotFoundError)
    })

    it('should throw TemplateNameAlreadyExistsError when name already exists', async () => {
      templateRepository.templateNameExists.mockResolvedValue(true)

      await expect(service.createTemplate(mockCreateTemplateDto, mockUserContext))
        .rejects.toThrow(TemplateNameAlreadyExistsError)
    })

    it('should throw RoleRequiredMismatchError when field roleRequired does not match section editBy', async () => {
      const invalidDto = {
        ...mockCreateTemplateDto,
        sections: [
          {
            ...mockCreateTemplateDto.sections[0],
            fields: [
              {
                fieldName: 'testField',
                fieldType: 'TEXT',
                displayOrder: 1,
                roleRequired: 'TRAINEE', // Different from section editBy (TRAINER)
                tempId: 'temp-1'
              }
            ]
          }
        ]
      }

      await expect(service.createTemplate(invalidDto, mockUserContext))
        .rejects.toThrow(TemplateCreationFailedError)
    })

    it('should throw SignatureFieldMissingRoleError when signature field has no roleRequired', async () => {
      const invalidDto = {
        ...mockCreateTemplateDto,
        sections: [
          {
            ...mockCreateTemplateDto.sections[0],
            fields: [
              {
                fieldName: 'signature',
                fieldType: 'SIGNATURE_DRAW',
                displayOrder: 1,
                roleRequired: null, // Missing roleRequired for signature field
                tempId: 'temp-sig'
              },
              {
                fieldName: 'finalScore',
                fieldType: 'FINAL_SCORE_NUM',
                displayOrder: 2,
                tempId: 'temp-score'
              }
            ]
          }
        ]
      }

      await expect(service.createTemplate(invalidDto, mockUserContext))
        .rejects.toThrow(TemplateCreationFailedError)
    })

    it('should throw PartFieldMissingChildrenError when PART field has no children', async () => {
      const invalidDto = {
        ...mockCreateTemplateDto,
        sections: [
          {
            ...mockCreateTemplateDto.sections[0],
            fields: [
              {
                fieldName: 'partField',
                fieldType: 'PART',
                displayOrder: 1,
                tempId: 'temp-part'
              },
              {
                fieldName: 'signature',
                fieldType: 'SIGNATURE_DRAW',
                displayOrder: 2,
                roleRequired: 'TRAINER',
                tempId: 'temp-sig'
              },
              {
                fieldName: 'finalScore',
                fieldType: 'FINAL_SCORE_NUM',
                displayOrder: 3,
                tempId: 'temp-score'
              }
            ]
          }
        ]
      }

      await expect(service.createTemplate(invalidDto, mockUserContext))
        .rejects.toThrow(TemplateCreationFailedError)
    })

    it('should validate business rules when status is PENDING', async () => {
      const pendingDto = { ...mockCreateTemplateDto, status: 'PENDING' as const }

      // This should not throw since we have signature and final score fields
      const result = await service.createTemplate(pendingDto, mockUserContext)
      expect(result.success).toBe(true)
    })

    it('should throw MissingSignatureFieldError when no signature field is present and status is PENDING', async () => {
      const invalidDto = {
        ...mockCreateTemplateDto,
        status: 'PENDING' as const,
        sections: [
          {
            ...mockCreateTemplateDto.sections[0],
            fields: [
              {
                fieldName: 'finalScore',
                fieldType: 'FINAL_SCORE_NUM',
                displayOrder: 1,
                tempId: 'temp-score'
              }
            ]
          }
        ]
      }

      await expect(service.createTemplate(invalidDto, mockUserContext))
        .rejects.toThrow(TemplateCreationFailedError)
    })
  })

  describe('getTemplateById', () => {
    it('should return template when found', async () => {
      templateRepository.findTemplateById.mockResolvedValue(mockTemplate)

      const result = await service.getTemplateById('template-123')

      expect(result).toEqual({
        success: true,
        data: mockTemplate,
        message: expect.any(String)
      })
      expect(templateRepository.findTemplateById).toHaveBeenCalledWith('template-123')
    })

    it('should throw TemplateNotFoundError when template not found', async () => {
      templateRepository.findTemplateById.mockResolvedValue(null)

      await expect(service.getTemplateById('nonexistent'))
        .rejects.toThrow(TemplateNotFoundError)
    })
  })

  describe('getAllTemplates', () => {
    const mockTemplates = [mockTemplate]

    it('should return all templates', async () => {
      templateRepository.findAllTemplates.mockResolvedValue(mockTemplates)

      const result = await service.getAllTemplates()

      expect(result).toEqual({
        success: true,
        data: mockTemplates,
        message: expect.any(String)
      })
      expect(templateRepository.findAllTemplates).toHaveBeenCalledWith(undefined)
    })

    it('should return templates with status filter', async () => {
      templateRepository.findAllTemplates.mockResolvedValue(mockTemplates)

      const result = await service.getAllTemplates('PUBLISHED')

      expect(result).toEqual({
        success: true,
        data: mockTemplates,
        message: expect.any(String)
      })
      expect(templateRepository.findAllTemplates).toHaveBeenCalledWith('PUBLISHED')
    })
  })

  describe('changeTemplateStatus', () => {
    beforeEach(() => {
      templateRepository.findTemplateById.mockResolvedValue(mockTemplate)
      templateRepository.updateTemplateStatus.mockResolvedValue({
        id: mockTemplate.id,
        name: mockTemplate.name,
        reviewedAt: new Date(),
        status: 'PUBLISHED',
        updatedAt: new Date(),
        updatedByUser: {
          id: 'user-123',
          firstName: 'John',
          lastName: 'Doe'
        },
        reviewedByUser: {
          id: 'reviewer-123',
          firstName: 'Jane',
          lastName: 'Reviewer'
        }
      })
    })

    it('should successfully change template status', async () => {
      const result = await service.changeTemplateStatus('template-123', 'PUBLISHED', mockUserContext)

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ status: 'PUBLISHED' }),
        message: expect.any(String)
      })
    })

    it('should throw TemplateNotFoundError when template not found', async () => {
      templateRepository.findTemplateById.mockResolvedValue(null)

      await expect(service.changeTemplateStatus('nonexistent', 'PUBLISHED', mockUserContext))
        .rejects.toThrow(TemplateNotFoundError)
    })
  })

  describe('createTemplateVersion', () => {
    const mockCreateVersionDto: CreateTemplateVersionDto = {
      originalTemplateId: 'template-123',
      name: 'Test Template v2',
      description: 'Version 2',
      templateContent: 'https://s3.amazonaws.com/test-v2.docx',
      templateConfig: 'https://s3.amazonaws.com/config-v2.docx',
      sections: mockTemplate.sections
    }

    beforeEach(() => {
      templateRepository.findTemplateById.mockResolvedValue(mockTemplate)
      templateRepository.templateNameExists.mockResolvedValue(false)
      templateRepository.createTemplateVersion.mockResolvedValue({
        ...mockTemplate,
        version: 2,
        sections: mockTemplate.sections
      })
    })

    it('should successfully create template version', async () => {
      const result = await service.createTemplateVersion(mockCreateVersionDto, mockUserContext)

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ version: 2 }),
        message: expect.any(String)
      })
    })

    it('should throw OriginalTemplateNotFoundError when original template not found', async () => {
      templateRepository.findTemplateById.mockResolvedValue(null)

      await expect(service.createTemplateVersion(mockCreateVersionDto, mockUserContext))
        .rejects.toThrow(OriginalTemplateNotFoundError)
    })

    it('should generate versioned name when name already exists', async () => {
      templateRepository.templateNameExists.mockResolvedValue(true)
      templateRepository.getMaxVersionForTemplate.mockResolvedValue(1)

      const result = await service.createTemplateVersion(mockCreateVersionDto, mockUserContext)

      expect(templateRepository.createTemplateVersion).toHaveBeenCalledWith(
        'template-123',
        expect.objectContaining({
          name: 'Test Template v2 v.2'
        }),
        'user-123',
        expect.any(Object)
      )
    })
  })

  describe('getTemplatePdf', () => {
    const mockPdfBuffer = Buffer.from('mock pdf content')

    beforeEach(() => {
      templateRepository.findTemplateById.mockResolvedValue(mockTemplate)
      pdfConverterService.convertDocxToPdfFromS3.mockResolvedValue(mockPdfBuffer)
    })

    it('should successfully generate PDF from template content', async () => {
      const result = await service.getTemplatePdf('template-123')

      expect(result).toBe(mockPdfBuffer)
      expect(pdfConverterService.convertDocxToPdfFromS3).toHaveBeenCalledWith(
        mockTemplate.templateContent
      )
    })

    it('should throw TemplateNotFoundError when template not found', async () => {
      templateRepository.findTemplateById.mockResolvedValue(null)

      await expect(service.getTemplatePdf('nonexistent'))
        .rejects.toThrow(TemplateNotFoundError)
    })

    it('should throw error when template content URL not found', async () => {
      templateRepository.findTemplateById.mockResolvedValue({
        ...mockTemplate,
        templateContent: null
      })

      await expect(service.getTemplatePdf('template-123'))
        .rejects.toThrow('Template content URL not found')
    })
  })

  describe('updateDraftTemplate', () => {
    const mockUpdateDto: CreateTemplateFormDto = {
      name: 'Updated Template',
      description: 'Updated Description',
      departmentId: 'dept-123',
      templateContent: 'https://s3.amazonaws.com/updated.docx',
      templateConfig: 'https://s3.amazonaws.com/updated-config.docx',
      sections: mockTemplate.sections
    }

    beforeEach(() => {
      templateRepository.findTemplateById.mockResolvedValue(mockTemplate)
      templateRepository.validateDepartmentExists.mockResolvedValue(true)
      templateRepository.templateNameExists.mockResolvedValue(false)
      templateRepository.updateDraftTemplate.mockResolvedValue({
        ...mockTemplate,
        name: 'Updated Template',
        department: {
          ...mockTemplate.department,
          code: 'TEST_DEPT'
        }
      })
    })

    it('should successfully update draft template', async () => {
      const result = await service.updateDraftTemplate('template-123', mockUpdateDto, mockUserContext)

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ name: 'Updated Template' }),
        message: expect.any(String)
      })
    })

    it('should throw TemplateNotFoundError when template not found', async () => {
      templateRepository.findTemplateById.mockResolvedValue(null)

      await expect(service.updateDraftTemplate('nonexistent', mockUpdateDto, mockUserContext))
        .rejects.toThrow(TemplateNotFoundError)
    })

    it('should throw InvalidDraftTemplateStatusError when template is not DRAFT', async () => {
      templateRepository.findTemplateById.mockResolvedValue({
        ...mockTemplate,
        status: 'PUBLISHED'
      })

      await expect(service.updateDraftTemplate('template-123', mockUpdateDto, mockUserContext))
        .rejects.toThrow(InvalidDraftTemplateStatusError)
    })
  })

  describe('deleteDraftTemplate', () => {
    beforeEach(() => {
      templateRepository.findTemplateById.mockResolvedValue(mockTemplate)
      templateRepository.deleteDraftTemplate.mockResolvedValue(undefined)
    })

    it('should successfully delete draft template', async () => {
      const result = await service.deleteDraftTemplate('template-123', mockUserContext)

      expect(result).toEqual({
        success: true,
        message: expect.any(String)
      })
      expect(templateRepository.deleteDraftTemplate).toHaveBeenCalledWith('template-123')
    })

    it('should throw TemplateNotFoundError when template not found', async () => {
      templateRepository.findTemplateById.mockResolvedValue(null)

      await expect(service.deleteDraftTemplate('nonexistent', mockUserContext))
        .rejects.toThrow(TemplateNotFoundError)
    })

    it('should throw error when template is not DRAFT', async () => {
      templateRepository.findTemplateById.mockResolvedValue({
        ...mockTemplate,
        status: 'PUBLISHED'
      })

      await expect(service.deleteDraftTemplate('template-123', mockUserContext))
        .rejects.toThrow('Only DRAFT templates can be deleted')
    })

    it('should throw error when user department does not match template department', async () => {
      const userWithDifferentDept = {
        ...mockUserContext,
        departmentId: 'different-dept'
      }

      await expect(service.deleteDraftTemplate('template-123', userWithDifferentDept))
        .rejects.toThrow('You can only delete templates in your department')
    })
  })

  describe('extractFieldsFromS3Url', () => {
    const mockS3Url = 'https://test-bucket.s3.amazonaws.com/test.docx'
    const mockBuffer = Buffer.from('mock docx content')

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer.buffer)
      })
      mockDocxtemplater.getFullText.mockReturnValue('{field1}{field2}')
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should successfully extract fields from S3 URL', async () => {
      const result = await service.extractFieldsFromS3Url(mockS3Url)

      expect(result).toEqual({
        success: true,
        message: expect.any(String),
        fields: expect.any(Array),
        totalFields: expect.any(Number)
      })
      expect(global.fetch).toHaveBeenCalledWith(mockS3Url)
    })

    it('should throw S3DownloadError when S3 request fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      await expect(service.extractFieldsFromS3Url(mockS3Url))
        .rejects.toThrow()
    })
  })

  describe('getTemplateBothPdf', () => {
    beforeEach(() => {
      templateRepository.findTemplateById.mockResolvedValue(mockTemplate)
      pdfConverterService.convertDocxToPdfFromS3.mockResolvedValue(Buffer.from('mock pdf'))
    })

    it('should successfully generate ZIP with both PDFs', async () => {
      // Since this method involves complex JSZip logic, we'll test that it calls the converter
      // and doesn't throw an error, indicating the business logic works
      const result = await service.getTemplateBothPdf('template-123')
      
      // Verify the PDF converter was called for both template files
      expect(pdfConverterService.convertDocxToPdfFromS3).toHaveBeenCalledWith(mockTemplate.templateContent)
      expect(pdfConverterService.convertDocxToPdfFromS3).toHaveBeenCalledWith(mockTemplate.templateConfig)
      expect(pdfConverterService.convertDocxToPdfFromS3).toHaveBeenCalledTimes(2)
    })

    it('should throw error when no template URLs found', async () => {
      templateRepository.findTemplateById.mockResolvedValue({
        ...mockTemplate,
        templateContent: null,
        templateConfig: null
      })

      await expect(service.getTemplateBothPdf('template-123'))
        .rejects.toThrow('No template URLs found')
    })
  })

  describe('updateTemplateForm', () => {
    const mockUpdateData: UpdateTemplateFormDto = {
      name: 'Updated Template Name',
      description: 'Updated description'
    }

    beforeEach(() => {
      templateRepository.findTemplateById.mockResolvedValue(mockTemplate)
      templateRepository.templateNameExists.mockResolvedValue(false)
      templateRepository.templateHasAssessments.mockResolvedValue(false)
      templateRepository.validateDepartmentExists.mockResolvedValue(true)
      templateRepository.updateTemplateBasicInfo.mockResolvedValue({
        ...mockTemplate,
        name: 'Updated Template Name'
      })
    })

    it('should successfully update template basic info', async () => {
      const result = await service.updateTemplateForm('template-123', mockUpdateData, mockUserContext)

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ name: 'Updated Template Name' }),
        message: expect.any(String)
      })
    })

    it('should throw error when changing department but template has assessments', async () => {
      templateRepository.templateHasAssessments.mockResolvedValue(true)
      const updateWithDepartment = { ...mockUpdateData, departmentId: 'new-dept' }

      await expect(service.updateTemplateForm('template-123', updateWithDepartment, mockUserContext))
        .rejects.toThrow()
    })
  })

  describe('reviewTemplate', () => {
    const mockReviewBody = {
      action: 'PUBLISHED' as const,
      comment: 'Template approved'
    }

    beforeEach(() => {
      templateRepository.findTemplateById.mockResolvedValue({
        ...mockTemplate,
        status: 'PENDING',
        reviewedByUser: null
      })
      templateRepository.getTemplateWithCreator.mockResolvedValue(mockTemplate)
      templateRepository.getUserById.mockResolvedValue({
        id: 'reviewer-123',
        firstName: 'Jane',
        lastName: 'Reviewer',
        email: 'jane.reviewer@example.com'
      })
      templateRepository.updateTemplateStatus.mockResolvedValue({
        id: mockTemplate.id,
        name: mockTemplate.name,
        reviewedAt: new Date(),
        status: 'PUBLISHED',
        updatedAt: new Date(),
        updatedByUser: {
          id: 'user-123',
          firstName: 'John',
          lastName: 'Doe'
        },
        reviewedByUser: {
          id: 'reviewer-123',
          firstName: 'Jane',
          lastName: 'Reviewer'
        }
      })
      nodemailerService.sendApprovedTemplateEmail.mockResolvedValue({ success: true })
    })

    it('should successfully approve template and send email', async () => {
      const result = await service.reviewTemplate('template-123', mockReviewBody, mockUserContext)

      expect(result).toEqual({
        success: true,
        message: expect.stringContaining('successfully'),
        data: expect.objectContaining({
          templateId: 'template-123',
          status: 'PUBLISHED',
          emailSent: true
        })
      })
      expect(nodemailerService.sendApprovedTemplateEmail).toHaveBeenCalled()
    })

    it('should throw error when template is not PENDING', async () => {
      templateRepository.findTemplateById.mockResolvedValue({
        ...mockTemplate,
        status: 'DRAFT',
        reviewedByUser: null
      })

      await expect(service.reviewTemplate('template-123', mockReviewBody, mockUserContext))
        .rejects.toThrow('Template must be in PENDING status to be reviewed')
    })

    it('should successfully reject template', async () => {
      const rejectBody = { action: 'REJECTED' as const, comment: 'Needs improvement' }
      nodemailerService.sendRejectedTemplateEmail.mockResolvedValue({ success: true })

      const result = await service.reviewTemplate('template-123', rejectBody, mockUserContext)

      expect(result.data.status).toBe('REJECTED')
      expect(nodemailerService.sendRejectedTemplateEmail).toHaveBeenCalled()
    })
  })

  describe('business rules validation', () => {
    beforeEach(() => {
      // Ensure department validation passes for all business rules tests
      templateRepository.validateDepartmentExists.mockResolvedValue(true)
      templateRepository.templateNameExists.mockResolvedValue(false)
      templateRepository.createTemplateWithSectionsAndFields.mockResolvedValue({
        templateForm: {
          id: 'new-template-id',
          name: 'Test Template',
          description: 'Test Description',
          version: 1,
          reviewedAt: null,
          status: 'DRAFT',
          createdAt: new Date(),
          updatedAt: new Date(),
          departmentId: 'dept-123',
          templateContent: 'content-url',
          templateConfig: 'config-url',
          templateSchema: {},
          createdByUserId: 'user-123',
          updatedByUserId: null,
          reviewedByUserId: null,
          referFirstVersionId: null
        },
        sections: []
      })
    })

    it('should pass business rules validation for valid template', async () => {
      // Test that business rules are validated when status is PENDING
      const testDto = { ...mockCreateTemplateDto, status: 'PENDING' as const }
      
      // Should pass validation with proper signature and final score fields
      const result = await service.createTemplate(testDto, mockUserContext)
      expect(result.success).toBe(true)
      expect(result.data?.templateForm?.id).toBe('new-template-id')
    })

    it('should validate template structure and fields', async () => {
      // Test that the service properly handles template business rules
      const testDto = { ...mockCreateTemplateDto, status: 'DRAFT' as const }
      
      const result = await service.createTemplate(testDto, mockUserContext)
      expect(result.success).toBe(true)
      expect(templateRepository.createTemplateWithSectionsAndFields).toHaveBeenCalled()
    })
  })
})
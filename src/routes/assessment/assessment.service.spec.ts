// import { Test, TestingModule } from '@nestjs/testing';
// import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
// import { AssessmentService } from './assessment.service';
// import { AssessmentRepo } from './assessment.repo';

// // Mock the error module to prevent import-time errors
// jest.mock('./assessment.error', () => ({
//   SubjectNotActiveException: new Error('Subject is not active or has been deleted'),
//   CourseNotActiveException: new Error('Course is not active or has been deleted'),
//   TemplateNotPublishedException: new Error('Only PUBLISHED templates can be used to create assessments')
// }));
// import { NodemailerService } from '../email/nodemailer.service';
// import { MediaService } from '../media/media.service';
// import { PdfConverterService } from '~/shared/services/pdf-converter.service';
// import { S3Service } from '~/shared/services/s3.service';
// import {
//   AssessmentFormCreationFailedException,
//   AssessmentNotFoundException,
//   AssessmentNotAccessibleException
// } from './assessment.error';
// import {
//   CreateAssessmentBodyType,
//   CreateBulkAssessmentBodyType,
//   GetAssessmentsQueryType,
//   GetSubjectAssessmentsQueryType,
//   GetCourseAssessmentsQueryType,
//   GetDepartmentAssessmentsQueryType,
//   SaveAssessmentValuesBodyType,
//   ToggleTraineeLockBodyType,
//   UpdateAssessmentValuesBodyType,
//   ConfirmAssessmentParticipationBodyType,
//   ApproveRejectAssessmentBodyType,
//   RenderDocxTemplateBodyType,
//   GetAssessmentEventsQueryType,
//   GetUserAssessmentEventsQueryType,
//   UpdateAssessmentEventParamsType,
//   UpdateAssessmentEventBodyType,
//   GetEventSubjectAssessmentsBodyType,
//   GetEventSubjectAssessmentsQueryType,
//   GetEventCourseAssessmentsBodyType,
//   GetEventCourseAssessmentsQueryType
// } from './assessment.dto';
// import { AssessmentResult } from '@prisma/client';

// describe('AssessmentService', () => {
//   let service: AssessmentService;
//   let assessmentRepo: jest.Mocked<AssessmentRepo>;
//   let nodemailerService: jest.Mocked<NodemailerService>;
//   let mediaService: jest.Mocked<MediaService>;
//   let pdfConverterService: jest.Mocked<PdfConverterService>;
//   let s3Service: jest.Mocked<S3Service>;

//   const mockCurrentUser = {
//     userId: 'user-123',
//     roleName: 'TRAINER',
//     departmentId: 'dept-123'
//   };

//   const mockTemplate = {
//     id: 'template-123',
//     name: 'Test Template',
//     templateStatus: 'PUBLISHED',
//     departmentId: 'dept-123',
//     department: {
//       id: 'dept-123',
//       name: 'Test Department',
//       code: 'TD'
//     },
//     sections: [
//       {
//         id: 'section-123',
//         label: 'Test Section',
//         displayOrder: 1,
//         fields: [
//           { 
//             id: 'field-123', 
//             fieldType: 'TEXT',
//             displayOrder: 1,
//             label: 'Test Field',
//             fieldName: 'testField'
//           }
//         ]
//       }
//     ]
//   };

//   const mockAssessment = {
//     id: 'assessment-123',
//     name: 'Test Assessment',
//     status: 'DRAFT',
//     traineeId: 'trainee-123',
//     subjectId: 'subject-123',
//     courseId: null,
//     occuranceDate: new Date('2024-12-15'),
//     template: mockTemplate
//   };

//   beforeEach(async () => {
//     const mockAssessmentRepo = {
//       getTemplateWithStructure: jest.fn(),
//       getSubjectWithDetails: jest.fn(),
//       getCourseWithDetails: jest.fn(),
//       validateTrainees: jest.fn(),
//       checkTraineeAssessmentExists: jest.fn(),
//       createAssessments: jest.fn(),
//       list: jest.fn(),
//       findById: jest.fn(),
//       checkAssessmentAccess: jest.fn(),
//       checkUserAssessmentAccess: jest.fn(),
//       getSubjectAssessments: jest.fn(),
//       getCourseAssessments: jest.fn(),
//       getDepartmentAssessments: jest.fn(),
//       getAssessmentSections: jest.fn(),
//       getTraineeSections: jest.fn(),
//       getAssessmentSectionFields: jest.fn(),
//       saveAssessmentValues: jest.fn(),
//       toggleTraineeLock: jest.fn(),
//       submitAssessment: jest.fn(),
//       updateAssessmentValues: jest.fn(),
//       confirmAssessmentParticipation: jest.fn(),
//       approveRejectAssessment: jest.fn(),
//       getAssessmentWithTemplateAndValues: jest.fn(),
//       getAssessmentValues: jest.fn(),
//       updateAssessmentPdfUrl: jest.fn(),
//       getAssessmentEvents: jest.fn(),
//       getUserAssessmentEvents: jest.fn(),
//       updateAssessmentEvent: jest.fn(),
//       getEventSubjectAssessments: jest.fn(),
//       getEventCourseAssessments: jest.fn(),
//       prismaClient: {
//         user: {
//           findUnique: jest.fn(),
//           findMany: jest.fn(),
//           findFirst: jest.fn()
//         },
//         assessmentForm: {
//           findUnique: jest.fn(),
//           update: jest.fn()
//         },
//         assessmentSection: {
//           findUnique: jest.fn()
//         },
//         assessmentValue: {
//           findMany: jest.fn()
//         },
//         subject: {
//           findUnique: jest.fn()
//         },
//         course: {
//           findUnique: jest.fn()
//         },
//         assessmentValueField: {
//           findFirst: jest.fn().mockResolvedValue({
//             id: 'field-123',
//             assessmentValue: {
//               id: 'value-123',
//               assessmentId: 'assessment-123'
//             }
//           })
//         }
//       }
//     };

//     const mockNodemailerService = {
//       sendRejectedAssessmentEmail: jest.fn()
//     };

//     const mockMediaService = {
//       uploadFile: jest.fn()
//     };

//     const mockPdfConverterService = {
//       convertDocxBufferToPdf: jest.fn()
//     };

//     const mockS3Service = {
//       uploadFile: jest.fn(),
//       getObject: jest.fn()
//     };

//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         AssessmentService,
//         { provide: AssessmentRepo, useValue: mockAssessmentRepo },
//         { provide: NodemailerService, useValue: mockNodemailerService },
//         { provide: MediaService, useValue: mockMediaService },
//         { provide: PdfConverterService, useValue: mockPdfConverterService },
//         { provide: S3Service, useValue: mockS3Service }
//       ]
//     }).compile();

//     service = module.get<AssessmentService>(AssessmentService);
//     assessmentRepo = module.get(AssessmentRepo);
//     nodemailerService = module.get(NodemailerService);
//     mediaService = module.get(MediaService);
//     pdfConverterService = module.get(PdfConverterService);
//     s3Service = module.get(S3Service);
//   });

//   describe('createAssessments', () => {
//     const createAssessmentData: CreateAssessmentBodyDTO = {
//       templateId: 'template-123',
//       subjectId: 'subject-123',
//       occuranceDate: new Date('2024-12-15'),
//       name: 'Test Assessment',
//       traineeIds: ['trainee-123', 'trainee-456']
//     };

//     it('should successfully create assessments', async () => {
//       // Mock template validation
//       assessmentRepo.getTemplateWithStructure.mockResolvedValue(mockTemplate);
      
//       // Mock subject validation
//       assessmentRepo.getSubjectWithDetails.mockResolvedValue({
//         id: 'subject-123',
//         name: 'Test Subject',
//         departmentId: 'dept-123',
//         startDate: new Date('2024-01-01'),
//         endDate: new Date('2024-12-31'),
//         passScore: 80,
//         status: 'ACTIVE' as any
//       });

//       // Mock trainee validation
//       assessmentRepo.validateTrainees.mockResolvedValue([
//         { 
//           id: 'trainee-123', 
//           eid: 'EID123',
//           firstName: 'John', 
//           lastName: 'Doe',
//           middleName: null,
//           email: 'john@test.com',
//           role: { name: 'TRAINEE' }
//         },
//         { 
//           id: 'trainee-456', 
//           eid: 'EID456',
//           firstName: 'Jane', 
//           lastName: 'Smith',
//           middleName: null,
//           email: 'jane@test.com',
//           role: { name: 'TRAINEE' }
//         }
//       ]);

//       // Mock existing assessment check
//       assessmentRepo.checkTraineeAssessmentExists.mockResolvedValue([]);

//       // Mock assessment creation
//       assessmentRepo.createAssessments.mockResolvedValue([
//         { 
//           id: 'assessment-123', 
//           templateId: 'template-123',
//           name: 'Test Assessment',
//           subjectId: 'subject-123',
//           courseId: null,
//           occuranceDate: new Date('2024-12-15'),
//           createdAt: new Date(),
//           updatedAt: new Date(),
//           createdById: 'user-123',
//           traineeId: 'trainee-123',
//           status: 'DRAFT' as any,
//           isTraineeLocked: false,
//           submittedAt: null,
//           submittedById: null,
//           approvedAt: null,
//           approvedById: null,
//           rejectedAt: null,
//           rejectedById: null,
//           rejectedComment: null,
//           signatureData: null,
//           signatureSaved: false,
//           pdfUrl: null,
//           trainee: null,
//           template: null,
//           subject: null,
//           course: null,
//           createdBy: null,
//           submittedBy: null,
//           approvedBy: null
//         },
//         { 
//           id: 'assessment-456', 
//           templateId: 'template-123',
//           name: 'Test Assessment',
//           subjectId: 'subject-123',
//           courseId: null,
//           occuranceDate: new Date('2024-12-15'),
//           createdAt: new Date(),
//           updatedAt: new Date(),
//           createdById: 'user-123',
//           traineeId: 'trainee-456',
//           status: 'DRAFT' as any,
//           isTraineeLocked: false,
//           submittedAt: null,
//           submittedById: null,
//           approvedAt: null,
//           approvedById: null,
//           rejectedAt: null,
//           rejectedById: null,
//           rejectedComment: null,
//           signatureData: null,
//           signatureSaved: false,
//           pdfUrl: null,
//           trainee: null,
//           template: null,
//           subject: null,
//           course: null,
//           createdBy: null,
//           submittedBy: null,
//           approvedBy: null
//         }
//       ]);

//       const result = await service.createAssessments(createAssessmentData, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(result.totalCreated).toBe(2);
//       expect(assessmentRepo.createAssessments).toHaveBeenCalled();
//     });

//     it('should throw error when template not found', async () => {
//       assessmentRepo.getTemplateWithStructure.mockResolvedValue(null);

//       await expect(
//         service.createAssessments(createAssessmentData, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('createBulkAssessments', () => {
//     const createBulkData: CreateBulkAssessmentsBodyDTO = {
//       templateId: 'template-123',
//       subjectId: 'subject-123',
//       occuranceDate: new Date('2024-12-15'),
//       name: 'Bulk Assessment',
//       excludeTraineeIds: []
//     };

//     it('should successfully create bulk assessments', async () => {
//       assessmentRepo.getTemplateWithStructure.mockResolvedValue(mockTemplate);
      
//       assessmentRepo.getSubjectWithDetails.mockResolvedValue({
//         id: 'subject-123',
//         name: 'Test Subject',
//         departmentId: 'dept-123',
//         startDate: new Date('2024-01-01'),
//         endDate: new Date('2024-12-31'),
//         passScore: 80,
//         status: 'ACTIVE',
//         enrollments: [
//           { trainee: { id: 'trainee-123', firstName: 'John', lastName: 'Doe', email: 'john@test.com', eid: 'EID123', middleName: null, enrollmentStatus: 'ENROLLED' } },
//           { trainee: { id: 'trainee-456', firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', eid: 'EID456', middleName: null, enrollmentStatus: 'ENROLLED' } }
//         ]
//       });

//       assessmentRepo.checkTraineeAssessmentExists.mockResolvedValue([]);
//       assessmentRepo.createAssessments.mockResolvedValue([
//         { id: 'assessment-123', traineeId: 'trainee-123' },
//         { id: 'assessment-456', traineeId: 'trainee-456' }
//       ]);

//       const result = await service.createBulkAssessments(createBulkData, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(result.totalCreated).toBe(2);
//     });

//     it('should handle no enrolled trainees scenario', async () => {
//       assessmentRepo.getTemplateWithStructure.mockResolvedValue(mockTemplate);
      
//       assessmentRepo.getSubjectWithDetails.mockResolvedValue({
//         id: 'subject-123',
//         name: 'Test Subject',
//         departmentId: 'dept-123',
//         startDate: new Date('2024-01-01'),
//         endDate: new Date('2024-12-31'),
//         passScore: 80,
//         status: 'ACTIVE',
//         enrollments: []
//       });

//       await expect(
//         service.createBulkAssessments(createBulkData, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('list', () => {
//     const query: GetAssessmentsQueryType = {
//       page: 1,
//       limit: 10,
//       search: '',
//       status: 'DRAFT'
//     };

//     it('should return list of assessments', async () => {
//       const mockResult = {
//         success: true,
//         data: [mockAssessment],
//         pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
//       };

//       assessmentRepo.list.mockResolvedValue(mockResult);

//       const result = await service.list(query, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(result.data).toHaveLength(1);
//       expect(assessmentRepo.list).toHaveBeenCalled();
//     });

//     it('should apply user filters for TRAINEE role', async () => {
//       const traineeUser = { ...mockCurrentUser, roleName: 'TRAINEE' };
//       const mockResult = {
//         success: true,
//         data: [],
//         pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
//       };

//       assessmentRepo.list.mockResolvedValue(mockResult);

//       await service.list(query, traineeUser);

//       expect(assessmentRepo.list).toHaveBeenCalledWith(
//         expect.objectContaining({ traineeId: traineeUser.userId })
//       );
//     });
//   });

//   describe('findById', () => {
//     it('should return assessment details when found and accessible', async () => {
//       assessmentRepo.findById.mockResolvedValue(mockAssessment);
//       assessmentRepo.checkAssessmentAccess.mockResolvedValue(true);

//       const result = await service.findById('assessment-123', mockCurrentUser);

//       expect(result).toEqual(mockAssessment);
//       expect(assessmentRepo.findById).toHaveBeenCalledWith('assessment-123');
//       expect(assessmentRepo.checkAssessmentAccess).toHaveBeenCalled();
//     });

//     it('should throw NotFoundException when assessment not found', async () => {
//       assessmentRepo.findById.mockResolvedValue(null);

//       await expect(
//         service.findById('nonexistent-id', mockCurrentUser)
//       ).rejects.toThrow(AssessmentNotFoundException);
//     });
//   });

//   describe('getSubjectAssessments', () => {
//     const query: GetSubjectAssessmentsQueryType = {
//       subjectId: 'subject-123',
//       page: 1,
//       limit: 10
//     };

//     it('should return subject assessments', async () => {
//       const mockResult = {
//         success: true,
//         data: [mockAssessment],
//         pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
//       };

//       assessmentRepo.getSubjectAssessments.mockResolvedValue(mockResult);

//       const result = await service.getSubjectAssessments(query, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.getSubjectAssessments).toHaveBeenCalledWith(
//         'subject-123', mockCurrentUser.userId, mockCurrentUser.roleName, 1, 10, undefined, undefined
//       );
//     });

//     it('should handle trainer not assigned error', async () => {
//       assessmentRepo.getSubjectAssessments.mockRejectedValue(
//         new Error('Trainer is not assigned to this subject')
//       );

//       await expect(
//         service.getSubjectAssessments(query, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('getCourseAssessments', () => {
//     const query: GetCourseAssessmentsQueryType = {
//       courseId: 'course-123',
//       page: 1,
//       limit: 10
//     };

//     it('should return course assessments', async () => {
//       const mockResult = {
//         success: true,
//         data: [mockAssessment],
//         pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
//       };

//       assessmentRepo.getCourseAssessments.mockResolvedValue(mockResult);

//       const result = await service.getCourseAssessments(query, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.getCourseAssessments).toHaveBeenCalled();
//     });

//     it('should handle course not found error', async () => {
//       assessmentRepo.getCourseAssessments.mockRejectedValue(
//         new Error('Course not found')
//       );

//       await expect(
//         service.getCourseAssessments(query, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('getDepartmentAssessments', () => {
//     const query: GetDepartmentAssessmentsQueryType = {
//       page: 1,
//       limit: 10
//     };

//     it('should return department assessments', async () => {
//       assessmentRepo.prismaClient.user.findUnique.mockResolvedValue({
//         departmentId: 'dept-123'
//       });

//       const mockResult = {
//         success: true,
//         data: [mockAssessment],
//         pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
//       };

//       assessmentRepo.getDepartmentAssessments.mockResolvedValue(mockResult);

//       const result = await service.getDepartmentAssessments(query, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.getDepartmentAssessments).toHaveBeenCalled();
//     });

//     it('should throw error when user has no department', async () => {
//       assessmentRepo.prismaClient.user.findUnique.mockResolvedValue({
//         departmentId: null
//       });

//       await expect(
//         service.getDepartmentAssessments(query, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('getAssessmentSections', () => {
//     it('should return assessment sections when user has access', async () => {
//       assessmentRepo.checkAssessmentAccess.mockResolvedValue(true);
//       const mockSections = {
//         success: true,
//         sections: [{ id: 'section-123', label: 'Test Section' }]
//       };
//       assessmentRepo.getAssessmentSections.mockResolvedValue(mockSections);

//       const result = await service.getAssessmentSections('assessment-123', mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.getAssessmentSections).toHaveBeenCalled();
//     });

//     it('should throw ForbiddenException when user has no access', async () => {
//       assessmentRepo.checkAssessmentAccess.mockResolvedValue(false);

//       await expect(
//         service.getAssessmentSections('assessment-123', mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('getTraineeSections', () => {
//     it('should return trainee sections', async () => {
//       const mockSections = {
//         success: true,
//         sections: [{ id: 'section-123', label: 'Trainee Section' }]
//       };
//       assessmentRepo.getTraineeSections.mockResolvedValue(mockSections);

//       const result = await service.getTraineeSections('assessment-123', mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.getTraineeSections).toHaveBeenCalledWith(
//         'assessment-123', mockCurrentUser.userId
//       );
//     });

//     it('should handle assessment not found error', async () => {
//       assessmentRepo.getTraineeSections.mockRejectedValue(
//         new Error('Assessment not found')
//       );

//       await expect(
//         service.getTraineeSections('nonexistent-id', mockCurrentUser)
//       ).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('getAssessmentSectionFields', () => {
//     it('should return section fields when user has access', async () => {
//       const mockSectionFields = {
//         assessmentSectionInfo: {
//           assessmentFormId: 'assessment-123',
//           templateSection: { editBy: 'TRAINER' }
//         },
//         fields: [{ id: 'field-123', assessmentValue: { id: 'value-123' } }]
//       };

//       assessmentRepo.getAssessmentSectionFields.mockResolvedValue(mockSectionFields);
//       assessmentRepo.checkAssessmentAccess.mockResolvedValue(true);
//       assessmentRepo.findById.mockResolvedValue({
//         ...mockAssessment,
//         subjectId: 'subject-123'
//       });

//       // Mock trainer assignment check
//       assessmentRepo.prismaClient.user.findFirst.mockResolvedValue({
//         subjectAssignments: [{ subjectId: 'subject-123', roleInSubject: 'TRAINER' }]
//       });

//       const result = await service.getAssessmentSectionFields('section-123', mockCurrentUser);

//       expect(result.fields).toHaveLength(1);
//       expect(assessmentRepo.getAssessmentSectionFields).toHaveBeenCalled();
//     });

//     it('should throw ForbiddenException when user cannot access section', async () => {
//       const mockSectionFields = {
//         assessmentSectionInfo: {
//           assessmentFormId: 'assessment-123',
//           templateSection: { editBy: 'TRAINER' }
//         },
//         fields: []
//       };

//       assessmentRepo.getAssessmentSectionFields.mockResolvedValue(mockSectionFields);
//       assessmentRepo.checkAssessmentAccess.mockResolvedValue(true);
//       assessmentRepo.findById.mockResolvedValue({
//         ...mockAssessment,
//         subjectId: 'subject-123'
//       });

//       // Mock no trainer assignment
//       assessmentRepo.prismaClient.user.findFirst.mockResolvedValue({
//         subjectAssignments: [],
//         subjectEnrollments: []
//       });

//       await expect(
//         service.getAssessmentSectionFields('section-123', mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('saveAssessmentValues', () => {
//     const saveValuesData: SaveAssessmentValuesBodyType = {
//       assessmentSectionId: 'section-123',
//       values: [
//         { assessmentValueId: 'value-123', answerValue: 'Test Answer' }
//       ]
//     };

//     it('should successfully save assessment values', async () => {
//       const mockSectionFields = {
//         fields: [{ assessmentValue: { id: 'value-123' } }]
//       };

//       assessmentRepo.getAssessmentSectionFields.mockResolvedValue(mockSectionFields);
      
//       assessmentRepo.prismaClient.assessmentSection.findUnique.mockResolvedValue({
//         assessmentForm: {
//           id: 'assessment-123',
//           traineeId: 'trainee-123',
//           subjectId: 'subject-123'
//         },
//         templateSection: {
//           editBy: 'TRAINER',
//           roleInSubject: 'TRAINER'
//         }
//       });

//       // Mock permission check
//       service['checkSectionEditPermission'] = jest.fn().mockResolvedValue(true);

//       const mockResult = {
//         success: true,
//         message: 'Values saved successfully'
//       };
//       assessmentRepo.saveAssessmentValues.mockResolvedValue(mockResult);

//       const result = await service.saveAssessmentValues(saveValuesData, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.saveAssessmentValues).toHaveBeenCalled();
//     });

//     it('should throw error when assessment value IDs are invalid', async () => {
//       const mockSectionFields = {
//         fields: [{ assessmentValue: { id: 'different-value-id' } }]
//       };

//       assessmentRepo.getAssessmentSectionFields.mockResolvedValue(mockSectionFields);
      
//       assessmentRepo.prismaClient.assessmentSection.findUnique.mockResolvedValue({
//         assessmentForm: {
//           id: 'assessment-123',
//           traineeId: 'trainee-123',
//           subjectId: 'subject-123'
//         },
//         templateSection: {
//           editBy: 'TRAINER',
//           roleInSubject: 'TRAINER'
//         }
//       });

//       await expect(
//         service.saveAssessmentValues(saveValuesData, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('toggleTraineeLock', () => {
//     const toggleLockData: ToggleTraineeLockBodyType = {
//       isTraineeLocked: true
//     };

//     it('should successfully toggle trainee lock', async () => {
//       assessmentRepo.checkAssessmentAccess.mockResolvedValue(true);
      
//       const mockResult = {
//         success: true,
//         isTraineeLocked: true,
//         message: 'Trainee lock toggled successfully'
//       };
//       assessmentRepo.toggleTraineeLock.mockResolvedValue(mockResult);

//       const result = await service.toggleTraineeLock('assessment-123', toggleLockData, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(result.isTraineeLocked).toBe(true);
//     });

//     it('should throw ForbiddenException when user has no access', async () => {
//       assessmentRepo.checkAssessmentAccess.mockResolvedValue(false);

//       await expect(
//         service.toggleTraineeLock('assessment-123', toggleLockData, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('submitAssessment', () => {
//     it('should successfully submit assessment', async () => {
//       assessmentRepo.checkAssessmentAccess.mockResolvedValue(true);
      
//       const mockResult = {
//         success: true,
//         message: 'Assessment submitted successfully'
//       };
//       assessmentRepo.submitAssessment.mockResolvedValue(mockResult);

//       const result = await service.submitAssessment('assessment-123', mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.submitAssessment).toHaveBeenCalledWith(
//         'assessment-123', mockCurrentUser.userId
//       );
//     });

//     it('should handle assessment not ready to submit error', async () => {
//       assessmentRepo.checkAssessmentAccess.mockResolvedValue(true);
//       assessmentRepo.submitAssessment.mockRejectedValue(
//         new Error('Assessment is not ready to submit')
//       );

//       await expect(
//         service.submitAssessment('assessment-123', mockCurrentUser)
//       ).rejects.toThrow(BadRequestException);
//     });
//   });

//   describe('updateAssessmentValues', () => {
//     const updateValuesData: UpdateAssessmentValuesBodyType = {
//       assessmentSectionId: 'section-123',
//       values: [
//         { assessmentValueId: 'value-123', answerValue: 'Updated Answer' }
//       ]
//     };

//     it('should successfully update assessment values', async () => {
//       const mockSectionFields = {
//         fields: [{ assessmentValue: { id: 'value-123' } }]
//       };

//       assessmentRepo.getAssessmentSectionFields.mockResolvedValue(mockSectionFields);
      
//       const mockResult = {
//         success: true,
//         message: 'Values updated successfully'
//       };
//       assessmentRepo.updateAssessmentValues.mockResolvedValue(mockResult);

//       const result = await service.updateAssessmentValues(updateValuesData, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.updateAssessmentValues).toHaveBeenCalled();
//     });

//     it('should throw error for invalid assessment value IDs', async () => {
//       const mockSectionFields = {
//         fields: [{ assessmentValue: { id: 'different-value-id' } }]
//       };

//       assessmentRepo.getAssessmentSectionFields.mockResolvedValue(mockSectionFields);

//       await expect(
//         service.updateAssessmentValues(updateValuesData, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('confirmAssessmentParticipation', () => {
//     const confirmParticipationData: ConfirmAssessmentParticipationBodyType = {
//       traineeSignatureUrl: 'https://s3.amazonaws.com/signature.png'
//     };

//     it('should successfully confirm participation for trainee', async () => {
//       const traineeUser = { ...mockCurrentUser, roleName: 'TRAINEE', userId: 'trainee-123' };
      
//       assessmentRepo.findById.mockResolvedValue({
//         ...mockAssessment,
//         traineeId: 'trainee-123',
//         status: 'SIGNATURE_PENDING'
//       });

//       const mockResult = {
//         updatedAt: new Date(),
//         status: 'READY_TO_SUBMIT',
//         signatureSaved: true
//       };
//       assessmentRepo.confirmAssessmentParticipation.mockResolvedValue(mockResult);

//       const result = await service.confirmAssessmentParticipation(
//         'assessment-123', confirmParticipationData, traineeUser
//       );

//       expect(result.success).toBe(true);
//       expect(result.status).toBe('READY_TO_SUBMIT');
//     });

//     it('should throw ForbiddenException for non-trainee user', async () => {
//       await expect(
//         service.confirmAssessmentParticipation(
//           'assessment-123', confirmParticipationData, mockCurrentUser
//         )
//       ).rejects.toThrow();
//     });
//   });

//   describe('approveRejectAssessment', () => {
//     const approveData: ApproveRejectAssessmentBodyType = {
//       action: 'APPROVED',
//       comment: 'Well done'
//     };

//     it('should successfully approve assessment', async () => {
//       assessmentRepo.findById.mockResolvedValue({
//         ...mockAssessment,
//         status: 'SUBMITTED'
//       });

//       assessmentRepo.prismaClient.user.findUnique.mockResolvedValue({
//         departmentId: 'dept-123'
//       });

//       const mockResult = {
//         status: 'APPROVED',
//         comment: 'Well done',
//         approvedById: mockCurrentUser.userId,
//         approvedAt: new Date(),
//         updatedAt: new Date()
//       };
//       assessmentRepo.approveRejectAssessment.mockResolvedValue(mockResult);

//       // Mock PDF generation methods
//       service['renderAssessmentToPdf'] = jest.fn().mockResolvedValue('https://s3.amazonaws.com/assessment.pdf');

//       const result = await service.approveRejectAssessment(
//         'assessment-123', approveData, mockCurrentUser
//       );

//       expect(result.success).toBe(true);
//       expect(result.message).toContain('approved');
//     });

//     it('should handle assessment not in SUBMITTED status', async () => {
//       assessmentRepo.findById.mockResolvedValue({
//         ...mockAssessment,
//         status: 'DRAFT'
//       });

//       await expect(
//         service.approveRejectAssessment('assessment-123', approveData, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('getAssessmentPdfUrl', () => {
//     it('should return PDF URL when assessment has PDF', async () => {
//       assessmentRepo.findById.mockResolvedValue({
//         ...mockAssessment,
//         pdfUrl: 'https://s3.amazonaws.com/assessment.pdf'
//       });

//       assessmentRepo.prismaClient.user.findUnique.mockResolvedValue({
//         departmentId: 'dept-123'
//       });

//       const result = await service.getAssessmentPdfUrl('assessment-123', mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(result.data.pdfUrl).toBe('https://s3.amazonaws.com/assessment.pdf');
//       expect(result.data.hasPdf).toBe(true);
//     });

//     it('should return no PDF when assessment has no PDF URL', async () => {
//       assessmentRepo.findById.mockResolvedValue({
//         ...mockAssessment,
//         pdfUrl: null
//       });

//       assessmentRepo.prismaClient.user.findUnique.mockResolvedValue({
//         departmentId: 'dept-123'
//       });

//       const result = await service.getAssessmentPdfUrl('assessment-123', mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(result.data.pdfUrl).toBeNull();
//       expect(result.data.hasPdf).toBe(false);
//     });
//   });

//   describe('renderDocxTemplateForTesting', () => {
//     const renderData: RenderDocxTemplateBodyType = {
//       templateUrl: 'https://s3.amazonaws.com/template.docx',
//       data: { field1: 'value1', field2: 'value2' }
//     };

//     it('should successfully render DOCX template', async () => {
//       const mockTemplateBuffer = Buffer.from('mock template');
//       const mockRenderedBuffer = Buffer.from('rendered template');

//       service['downloadFileFromS3'] = jest.fn().mockResolvedValue(mockTemplateBuffer);
//       service['renderDocxTemplate'] = jest.fn().mockResolvedValue(mockRenderedBuffer);

//       const result = await service.renderDocxTemplateForTesting(renderData);

//       expect(result.success).toBe(true);
//       expect(result.data.filename).toContain('test-template-');
//       expect(result.data.contentType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
//     });

//     it('should handle template download failure', async () => {
//       service['downloadFileFromS3'] = jest.fn().mockRejectedValue(
//         new Error('Failed to download template')
//       );

//       await expect(
//         service.renderDocxTemplateForTesting(renderData)
//       ).rejects.toThrow(BadRequestException);
//     });
//   });

//   describe('renderDocxTemplateWithImagesForTesting', () => {
//     const renderData: RenderDocxTemplateBodyType = {
//       templateUrl: 'https://s3.amazonaws.com/template.docx',
//       data: { 
//         textField: 'value1', 
//         imageField: 'https://s3.amazonaws.com/image.jpg' 
//       }
//     };

//     it('should successfully render DOCX template with images', async () => {
//       const mockTemplateBuffer = Buffer.from('mock template');
//       const mockRenderedBuffer = Buffer.from('rendered template with images');

//       service['downloadFileFromS3'] = jest.fn().mockResolvedValue(mockTemplateBuffer);
//       service['renderDocxTemplate'] = jest.fn().mockResolvedValue(mockRenderedBuffer);

//       const result = await service.renderDocxTemplateWithImagesForTesting(renderData);

//       expect(result.success).toBe(true);
//       expect(result.data.filename).toContain('test-template-with-mixed-data-');
//       expect(result.message).toContain('mixed data (text + images)');
//     });

//     it('should handle image processing failure', async () => {
//       service['downloadFileFromS3'] = jest.fn().mockResolvedValue(Buffer.from('template'));
//       service['renderDocxTemplate'] = jest.fn().mockRejectedValue(
//         new Error('Image processing failed')
//       );

//       await expect(
//         service.renderDocxTemplateWithImagesForTesting(renderData)
//       ).rejects.toThrow(BadRequestException);
//     });
//   });

//   describe('getAssessmentEvents', () => {
//     const query: GetAssessmentEventsQueryType = {
//       page: 1,
//       limit: 10
//     };

//     it('should return assessment events', async () => {
//       const mockEvents = {
//         success: true,
//         data: [
//           { id: 'event-123', name: 'Test Event', occuranceDate: '2024-12-15' }
//         ],
//         pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
//       };

//       assessmentRepo.getAssessmentEvents.mockResolvedValue(mockEvents);

//       const result = await service.getAssessmentEvents(query, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(result.data).toHaveLength(1);
//     });

//     it('should handle empty events list', async () => {
//       const mockEvents = {
//         success: true,
//         data: [],
//         pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
//       };

//       assessmentRepo.getAssessmentEvents.mockResolvedValue(mockEvents);

//       const result = await service.getAssessmentEvents(query, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(result.data).toHaveLength(0);
//     });
//   });

//   describe('getUserAssessmentEvents', () => {
//     const query: GetUserAssessmentEventsQueryType = {
//       page: 1,
//       limit: 10
//     };

//     it('should return user assessment events', async () => {
//       const mockUserEvents = {
//         success: true,
//         data: [
//           { id: 'event-123', name: 'User Event', occuranceDate: '2024-12-15' }
//         ],
//         pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
//       };

//       assessmentRepo.getUserAssessmentEvents.mockResolvedValue(mockUserEvents);

//       const result = await service.getUserAssessmentEvents(query, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.getUserAssessmentEvents).toHaveBeenCalledWith(
//         mockCurrentUser.userId, mockCurrentUser.roleName, query.page, query.limit, query.search, undefined, undefined
//       );
//     });

//     it('should handle service error', async () => {
//       assessmentRepo.getUserAssessmentEvents.mockRejectedValue(
//         new Error('Database error')
//       );

//       await expect(
//         service.getUserAssessmentEvents(query, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('updateAssessmentEvent', () => {
//     const params: UpdateAssessmentEventParamsType = {
//       eventId: 'event-123'
//     };

//     const updateData: UpdateAssessmentEventBodyType = {
//       name: 'Updated Event Name',
//       occuranceDate: '2024-12-20'
//     };

//     it('should successfully update assessment event', async () => {
//       const mockResult = {
//         success: true,
//         message: 'Event updated successfully',
//         data: {
//           eventId: 'event-123',
//           name: 'Updated Event Name',
//           occuranceDate: '2024-12-20'
//         }
//       };

//       assessmentRepo.updateAssessmentEvent.mockResolvedValue(mockResult);

//       const result = await service.updateAssessmentEvent(params, updateData, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(result.data.name).toBe('Updated Event Name');
//     });

//     it('should handle event not found', async () => {
//       assessmentRepo.updateAssessmentEvent.mockRejectedValue(
//         new Error('Event not found')
//       );

//       await expect(
//         service.updateAssessmentEvent(params, updateData, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('getEventSubjectAssessments', () => {
//     const body: GetEventSubjectAssessmentsBodyType = {
//       templateId: 'template-123',
//       subjectId: 'subject-123',
//       occuranceDate: '2024-12-15'
//     };

//     const query: GetEventSubjectAssessmentsQueryType = {
//       page: 1,
//       limit: 10
//     };

//     it('should return event subject assessments', async () => {
//       const mockResult = {
//         success: true,
//         data: [mockAssessment],
//         pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
//       };

//       assessmentRepo.getEventSubjectAssessments.mockResolvedValue(mockResult);

//       const result = await service.getEventSubjectAssessments(body, query, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.getEventSubjectAssessments).toHaveBeenCalledWith(
//         body.subjectId, body.templateId, body.occuranceDate,
//         mockCurrentUser.userId, mockCurrentUser.roleName,
//         query.page, query.limit, query.status, query.search
//       );
//     });

//     it('should handle invalid event parameters', async () => {
//       assessmentRepo.getEventSubjectAssessments.mockRejectedValue(
//         new Error('Invalid event parameters')
//       );

//       await expect(
//         service.getEventSubjectAssessments(body, query, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });

//   describe('getEventCourseAssessments', () => {
//     const body: GetEventCourseAssessmentsBodyType = {
//       templateId: 'template-123',
//       courseId: 'course-123',
//       occuranceDate: '2024-12-15'
//     };

//     const query: GetEventCourseAssessmentsQueryType = {
//       page: 1,
//       limit: 10
//     };

//     it('should return event course assessments', async () => {
//       const mockResult = {
//         success: true,
//         data: [mockAssessment],
//         pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
//       };

//       assessmentRepo.getEventCourseAssessments.mockResolvedValue(mockResult);

//       const result = await service.getEventCourseAssessments(body, query, mockCurrentUser);

//       expect(result.success).toBe(true);
//       expect(assessmentRepo.getEventCourseAssessments).toHaveBeenCalledWith(
//         body.courseId, body.templateId, body.occuranceDate,
//         mockCurrentUser.userId, mockCurrentUser.roleName,
//         query.page, query.limit, query.status, query.search
//       );
//     });

//     it('should handle course access denied', async () => {
//       assessmentRepo.getEventCourseAssessments.mockRejectedValue(
//         new Error('Access denied to course')
//       );

//       await expect(
//         service.getEventCourseAssessments(body, query, mockCurrentUser)
//       ).rejects.toThrow();
//     });
//   });
// });
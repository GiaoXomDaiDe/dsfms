// import { Injectable } from '@nestjs/common'
// import { Prisma } from '@prisma/client'
// import {
//   CreateRequestBodyType,
//   CreateRequestResType,
//   GetMyRequestsQueryType,
//   GetMyRequestsResType,
//   GetRequestsQueryType,
//   GetRequestsResType,
//   RequestWithRelationsType,
//   UpdateRequestStatusBodyType,
//   UpdateRequestStatusResType
// } from '~/routes/request/request.model'
// import { RequestType } from '~/shared/constants/request.constant'
// import { PrismaService } from '~/shared/services/prisma.service'

// @Injectable()
// export class RequestRepo {
//   private readonly requestInclude = {
//     createdBy: {
//       select: {
//         id: true,
//         eid: true,
//         firstName: true,
//         lastName: true,
//         email: true,
//         role: {
//           select: {
//             name: true
//           }
//         }
//       }
//     },
//     managedBy: {
//       select: {
//         id: true,
//         eid: true,
//         firstName: true,
//         lastName: true,
//         email: true,
//         role: {
//           select: {
//             name: true
//           }
//         }
//       }
//     },
//     updatedBy: {
//       select: {
//         id: true,
//         eid: true,
//         firstName: true,
//         lastName: true,
//         email: true,
//         role: {
//           select: {
//             name: true
//           }
//         }
//       }
//     },
//     assessment: {
//       select: {
//         id: true,
//         name: true,
//         description: true
//       }
//     }
//   } satisfies Prisma.RequestInclude

//   constructor(private readonly prisma: PrismaService) {}

//   async list(query: GetRequestsQueryType): Promise<GetRequestsResType> {
//     const {
//       page = 1,
//       limit = 10,
//       requestType,
//       severity,
//       status,
//       managedByUserId,
//       createdByUserId,
//       search,
//       fromDate,
//       toDate
//     } = query
//     const skip = (page - 1) * limit

//     const where: Prisma.RequestWhereInput = {
//       ...(requestType && { requestType }),
//       ...(severity && { severity }),
//       ...(status && { status }),
//       ...(managedByUserId && { managedByUserId }),
//       ...(createdByUserId && { createdByUserId }),
//       ...(search && {
//         OR: [
//           { title: { contains: search, mode: 'insensitive' } },
//           { description: { contains: search, mode: 'insensitive' } },
//           { actionsTaken: { contains: search, mode: 'insensitive' } }
//         ]
//       }),
//       ...(fromDate || toDate
//         ? {
//             createdAt: {
//               ...(fromDate && { gte: new Date(fromDate) }),
//               ...(toDate && { lte: new Date(toDate) })
//             }
//           }
//         : {})
//     }

//     const [totalItems, requests] = await this.prisma.$transaction([
//       this.prisma.request.count({ where }),
//       this.prisma.request.findMany({
//         where,
//         include: this.requestInclude,
//         orderBy: { createdAt: 'desc' },
//         skip,
//         take: limit
//       })
//     ])

//     const formattedRequests = requests.map((request) => this.mapRequest(request))

//     const totalPages = limit === 0 ? 0 : Math.ceil(totalItems / limit)

//     return {
//       requests: formattedRequests,
//       totalItems,
//       totalPages,
//       currentPage: page
//     }
//   }

//   async listMine(userId: string, query: GetMyRequestsQueryType): Promise<GetMyRequestsResType> {
//     const { page = 1, limit = 10, requestType, status } = query
//     const skip = (page - 1) * limit

//     const where: Prisma.RequestWhereInput = {
//       createdByUserId: userId,
//       ...(requestType && { requestType }),
//       ...(status && { status })
//     }

//     const [totalItems, requests] = await this.prisma.$transaction([
//       this.prisma.request.count({ where }),
//       this.prisma.request.findMany({
//         where,
//         include: this.requestInclude,
//         orderBy: { createdAt: 'desc' },
//         skip,
//         take: limit
//       })
//     ])

//     const formattedRequests = requests.map((request) => this.mapRequest(request))
//     const totalPages = limit === 0 ? 0 : Math.ceil(totalItems / limit)

//     return {
//       requests: formattedRequests,
//       totalItems,
//       totalPages,
//       currentPage: page
//     }
//   }

//   async findById(id: string): Promise<RequestWithRelationsType | null> {
//     const request = await this.prisma.request.findUnique({
//       where: { id },
//       include: this.requestInclude
//     })

//     if (!request) {
//       return null
//     }

//     return this.mapRequest(request)
//   }

//   async create({
//     data,
//     createdById
//   }: {
//     data: CreateRequestBodyType
//     createdById: string
//   }): Promise<CreateRequestResType> {
//     const request = await this.prisma.request.create({
//       data: {
//         requestType: data.requestType,
//         createdByUserId: createdById,
//         severity: data.requestType === RequestType.ASSESSMENT_APPROVAL_REQUEST ? null : (data.severity ?? null),
//         title: data.requestType === RequestType.ASSESSMENT_APPROVAL_REQUEST ? null : (data.title ?? null),
//         description: data.requestType === RequestType.ASSESSMENT_APPROVAL_REQUEST ? null : (data.description ?? null),
//         actionsTaken: data.requestType === RequestType.ASSESSMENT_APPROVAL_REQUEST ? null : (data.actionsTaken ?? null),
//         isAnonymous: data.isAnonymous ?? false,
//         assessmentId: data.assessmentId ?? null
//       },
//       include: this.requestInclude
//     })

//     return this.mapRequest(request)
//   }

//   async updateStatus({
//     id,
//     data,
//     updatedById
//   }: {
//     id: string
//     data: UpdateRequestStatusBodyType
//     updatedById: string
//   }): Promise<UpdateRequestStatusResType> {
//     const request = await this.prisma.request.update({
//       where: { id },
//       data: {
//         ...(data.status && { status: data.status }),
//         ...(data.managedByUserId && { managedByUserId: data.managedByUserId }),
//         ...(data.response && { response: data.response }),
//         ...(data.severity && { severity: data.severity }),
//         ...(data.actionsTaken && { actionsTaken: data.actionsTaken }),
//         updatedById
//       },
//       include: this.requestInclude
//     })

//     return this.mapRequest(request)
//   }

//   private mapRequest(
//     request: Prisma.RequestGetPayload<{ include: typeof this.requestInclude }>
//   ): RequestWithRelationsType {
//     const { createdBy, managedBy, updatedBy, ...rest } = request

//     return {
//       ...rest,
//       createdBy: {
//         id: createdBy.id,
//         eid: createdBy.eid,
//         firstName: createdBy.firstName,
//         lastName: createdBy.lastName,
//         email: createdBy.email,
//         roleName: createdBy.role?.name ?? null
//       },
//       managedBy: managedBy
//         ? {
//             id: managedBy.id,
//             eid: managedBy.eid,
//             firstName: managedBy.firstName,
//             lastName: managedBy.lastName,
//             email: managedBy.email,
//             roleName: managedBy.role?.name ?? null
//           }
//         : null,
//       updatedBy: updatedBy
//         ? {
//             id: updatedBy.id,
//             eid: updatedBy.eid,
//             firstName: updatedBy.firstName,
//             lastName: updatedBy.lastName,
//             email: updatedBy.email,
//             roleName: updatedBy.role?.name ?? null
//           }
//         : null
//     } as RequestWithRelationsType
//   }
// }

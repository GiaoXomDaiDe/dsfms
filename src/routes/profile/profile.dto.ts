import { createZodDto } from 'nestjs-zod'
import { ResetPasswordBodySchema, UpdateMeBodySchema, UpdateProfileBodySchema, UpdateSignatureBodySchema } from '~/routes/profile/profile.model'

export class UpdateMeBodyDTO extends createZodDto(UpdateMeBodySchema) {}

export class UpdateProfileBodyDTO extends createZodDto(UpdateProfileBodySchema) {}

export class ResetPasswordBodyDTO extends createZodDto(ResetPasswordBodySchema) {}

export class UpdateSignatureBodyDTO extends createZodDto(UpdateSignatureBodySchema) {}

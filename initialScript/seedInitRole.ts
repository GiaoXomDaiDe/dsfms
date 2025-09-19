import envConfig from '~/shared/config'
import { GenderStatus, RoleName } from '~/shared/constants/auth.constant'
import { EidService } from '~/shared/services/eid.service'
import { HashingService } from '~/shared/services/hashing.service'
import { PrismaService } from '~/shared/services/prisma.service'

const prismaService = new PrismaService()
const hashingService = new HashingService()
const eidService = new EidService(prismaService)

const main = async () => {
  const roleCount = await prismaService.role.count()
  if (roleCount > 0) {
    throw new Error('Roles already exist')
  }
  const roles = await prismaService.role.createManyAndReturn({
    data: [
      { name: RoleName.ADMINISTRATOR, description: 'Administrator role' },
      { name: RoleName.TRAINEE, description: 'Trainee role' },
      { name: RoleName.TRAINER, description: 'Trainer role' },
      { name: RoleName.DEPARTMENT_HEAD, description: 'Department Head role' },
      { name: RoleName.SQA_AUDITOR, description: 'SQA Auditor role' }
    ]
  })

  const adminRole = roles.find((role) => role.name === RoleName.ADMINISTRATOR)

  const hashedPassword = await hashingService.hashPassword(envConfig.ADMIN_PASSWORD)

  const adminEid = await eidService.generateEid({ roleName: RoleName.ADMINISTRATOR })

  const adminUser = await prismaService.user.create({
    data: {
      email: envConfig.ADMIN_EMAIL,
      eid: adminEid as string,
      firstName: envConfig.ADMIN_FIRST_NAME,
      middleName: envConfig.ADMIN_MIDDLE_NAME,
      lastName: envConfig.ADMIN_LAST_NAME,
      gender: GenderStatus.MALE,
      passwordHash: hashedPassword,
      roleId: adminRole!.id
    }
  })
  return {
    adminUser,
    createdRoleCounts: roles.length
  }
}

main()
  .then(({ adminUser, createdRoleCounts }) => {
    console.log('Tài khoản admin đã tạo:', adminUser)
    console.log('Số lượng vai trò đã tạo:', createdRoleCounts)
  })
  .catch((error) => {
    console.error('Lỗi xảy ra trong quá trình tạo tài khoản admin và vai trò:', error)
  })

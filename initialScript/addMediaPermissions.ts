import { NestFactory } from '@nestjs/core'
import { AppModule } from '~/app.module'
import { HTTPMethod, RoleName } from '~/shared/constants/auth.constant'
import { ActiveStatus } from '~/shared/constants/default.constant'
import { PrismaService } from '~/shared/services/prisma.service'

const prisma = new PrismaService()

// Định nghĩa media permissions cho từng module
const MEDIA_PERMISSIONS = [
  // Images upload permissions
  {
    path: '/media/images/upload/:type',
    method: 'POST' as keyof typeof HTTPMethod,
    name: 'POST /media/images/upload/:type',
    module: 'MEDIA',
    viewName: 'Upload Images',
    viewModule: 'Media Management',
    isActive: ActiveStatus.ACTIVE
  },
  {
    path: '/media/images/upload/presigned-url',
    method: 'POST' as keyof typeof HTTPMethod,
    name: 'POST /media/images/upload/presigned-url',
    module: 'MEDIA',
    viewName: 'Create Image Presigned URL',
    viewModule: 'Media Management',
    isActive: ActiveStatus.ACTIVE
  },

  // Documents upload permissions
  {
    path: '/media/docs/upload/:type',
    method: 'POST' as keyof typeof HTTPMethod,
    name: 'POST /media/docs/upload/:type',
    module: 'MEDIA',
    viewName: 'Upload Documents',
    viewModule: 'Media Management',
    isActive: ActiveStatus.ACTIVE
  },
  {
    path: '/media/docs/upload/presigned-url',
    method: 'POST' as keyof typeof HTTPMethod,
    name: 'POST /media/docs/upload/presigned-url',
    module: 'MEDIA',
    viewName: 'Create Document Presigned URL',
    viewModule: 'Media Management',
    isActive: ActiveStatus.ACTIVE
  },

  // Static file serving (public - no permission needed, but documented)
  {
    path: '/media/static/:filename',
    method: 'GET' as keyof typeof HTTPMethod,
    name: 'GET /media/static/:filename',
    module: 'MEDIA',
    viewName: 'Serve Static Files',
    viewModule: 'Media Management',
    isActive: ActiveStatus.ACTIVE
  }
]

// Định nghĩa permissions cho từng role
const ROLE_PERMISSIONS = {
  [RoleName.ADMINISTRATOR]: [
    // Admin có thể làm tất cả
    'POST /media/images/upload/:type',
    'POST /media/images/upload/presigned-url',
    'POST /media/docs/upload/:type',
    'POST /media/docs/upload/presigned-url',
    'GET /media/static/:filename'
  ],

  [RoleName.ACADEMIC_DEPARTMENT]: [
    // Academic Department có thể upload images và docs
    'POST /media/images/upload/:type',
    'POST /media/images/upload/presigned-url',
    'POST /media/docs/upload/:type',
    'POST /media/docs/upload/presigned-url',
    'GET /media/static/:filename'
  ],

  [RoleName.DEPARTMENT_HEAD]: [
    // Department Head có thể upload images và docs
    'POST /media/images/upload/:type',
    'POST /media/images/upload/presigned-url',
    'POST /media/docs/upload/:type',
    'POST /media/docs/upload/presigned-url',
    'GET /media/static/:filename'
  ],

  [RoleName.TRAINER]: [
    // Trainer có thể upload images và docs
    'POST /media/images/upload/:type',
    'POST /media/images/upload/presigned-url',
    'POST /media/docs/upload/:type',
    'POST /media/docs/upload/presigned-url',
    'GET /media/static/:filename'
  ],

  [RoleName.TRAINEE]: [
    // Trainee chỉ có thể upload images (avatar, etc.) và xem static files
    'POST /media/images/upload/:type',
    'POST /media/images/upload/presigned-url',
    'GET /media/static/:filename'
  ]
}

async function addMediaPermissions() {
  console.log('🚀 Starting media permissions setup...')

  try {
    // 1. Thêm permissions vào database
    console.log('📝 Adding media permissions to database...')

    for (const permission of MEDIA_PERMISSIONS) {
      // Check if permission already exists
      const existingPermission = await prisma.permission.findFirst({
        where: {
          path: permission.path,
          method: permission.method,
          deletedAt: null
        }
      })

      if (!existingPermission) {
        await prisma.permission.create({
          data: permission
        })
        console.log(`   ✅ Added: ${permission.name}`)
      } else {
        console.log(`   ⚠️  Already exists: ${permission.name}`)
      }
    }

    // 2. Lấy tất cả media permissions từ database
    const mediaPermissions = await prisma.permission.findMany({
      where: {
        module: 'MEDIA',
        deletedAt: null
      }
    })

    console.log(`📊 Found ${mediaPermissions.length} media permissions in database`)

    // 3. Cập nhật permissions cho từng role
    console.log('🔐 Updating role permissions...')

    for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
      // Tìm role
      const role = await prisma.role.findFirst({
        where: {
          name: roleName,
          deletedAt: null
        },
        include: {
          permissions: true
        }
      })

      if (!role) {
        console.log(`   ❌ Role not found: ${roleName}`)
        continue
      }

      // Tìm media permissions cho role này
      const roleMediaPermissions = mediaPermissions.filter((p) => permissionNames.includes(p.name))

      // Lấy current permissions của role (non-media)
      const currentNonMediaPermissions = role.permissions.filter((p) => p.module !== 'MEDIA')

      // Combine current non-media permissions với media permissions mới
      const allPermissionIds = [
        ...currentNonMediaPermissions.map((p) => ({ id: p.id })),
        ...roleMediaPermissions.map((p) => ({ id: p.id }))
      ]

      // Update role permissions
      await prisma.role.update({
        where: { id: role.id },
        data: {
          permissions: {
            set: allPermissionIds
          }
        }
      })

      console.log(`   ✅ Updated ${roleName}: +${roleMediaPermissions.length} media permissions`)
    }

    // 4. Hiển thị tổng kết
    console.log('\n📈 Summary:')
    for (const [roleName] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await prisma.role.findFirst({
        where: { name: roleName, deletedAt: null },
        include: { _count: { select: { permissions: true } } }
      })

      if (role) {
        console.log(`   ${roleName}: ${role._count.permissions} total permissions`)
      }
    }

    console.log('\n🎉 Media permissions setup completed successfully!')
  } catch (error) {
    console.error('❌ Error setting up media permissions:', error)
    throw error
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  await app.listen(3001)

  try {
    await addMediaPermissions()
  } finally {
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  }
}

bootstrap().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

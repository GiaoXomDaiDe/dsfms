import { NestFactory } from '@nestjs/core'
import { AppModule } from '~/app.module'
import { PermissionType } from '~/routes/permission/permission.model'
import { HTTPMethod } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'

const prisma = new PrismaService()

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  await app.listen(3001)
  const server = app.getHttpAdapter().getInstance()
  const router = server.router

  const permissionsInDb = await prisma.permission.findMany({
    where: {
      deletedAt: null
    }
  })

  const availableRoutes: { path: string; method: keyof typeof HTTPMethod; name: string; module: string }[] =
    router.stack
      .map((layer: any) => {
        if (layer.route) {
          const path = layer.route?.path
          const method = String(layer.route?.stack[0].method).toUpperCase() as keyof typeof HTTPMethod
          const moduleName = String(path.split('/')[1]).toUpperCase()
          return {
            path,
            method,
            name: method + ' ' + path,
            module: moduleName
          }
        }
      })
      .filter((item: any) => item !== undefined)

  // Tạo object permissionInDbMap với key là [method-path]
  const permissionInDbMap: Record<string, PermissionType> = permissionsInDb.reduce(
    (acc: Record<string, PermissionType>, item: PermissionType) => {
      acc[`${item.method}-${item.path}`] = item
      return acc
    },
    {} as Record<string, PermissionType>
  )
  // Tạo object availableRoutesMap với key là [method-path]
  const availableRoutesMap: Record<string, (typeof availableRoutes)[0]> = availableRoutes.reduce(
    (acc: Record<string, (typeof availableRoutes)[0]>, item: (typeof availableRoutes)[0]) => {
      acc[`${item.method}-${item.path}`] = item
      return acc
    },
    {} as Record<string, (typeof availableRoutes)[0]>
  )

  // // Tìm permissions trong database mà không tồn tại trong availableRoutes
  // const permissionsToDelete = permissionsInDb.filter((item: PermissionType) => {
  //   return !availableRoutesMap[`${item.method}-${item.path}`]
  // })
  // // Xóa permissions trong database không tồn tại trong availableRoutes
  // if (permissionsToDelete.length > 0) {
  //   const deleteResult = await prisma.permission.deleteMany({
  //     where: {
  //       id: {
  //         in: permissionsToDelete.map((item: PermissionType) => item.id)
  //       }
  //     }
  //   })
  //   console.log('Deleted permissions:', deleteResult.count)
  // } else {
  //   console.log('No permissions to delete')
  // }
  // Tìm permissions trong availableRoutes mà không tồn tại trong permissionsInDb
  const permissionsToAdd = availableRoutes.filter((item) => {
    return !permissionInDbMap[`${item.method}-${item.path}`]
  })
  // Thêm các permissions này vào database
  if (permissionsToAdd.length > 0) {
    const addResult = await prisma.permission.createMany({
      data: permissionsToAdd,
      skipDuplicates: true
    })
    console.log('Added permissions:', addResult.count)
  } else {
    console.log('No permissions to add')
  }

  // Lấy ra permissions trong database sau khi thêm mới (hoặc bị xóa)
  const updatedPermissionsInDb = await prisma.permission.findMany({
    where: {
      deletedAt: null
    }
  })
  console.log('Total permissions in DB:', updatedPermissionsInDb)

  const adminPermissionIds = updatedPermissionsInDb.map((item: PermissionType) => ({ id: item.id }))
  await updateRole(adminPermissionIds, 'ADMINISTRATOR')
  process.exit(0)
}

const updateRole = async (permissionIds: { id: string }[], roleName: string) => {
  // Cập nhật lại các permissions trong Admin Role
  const role = await prisma.role.findFirstOrThrow({
    where: {
      name: roleName,
      deletedAt: null
    }
  })
  await prisma.role.update({
    where: {
      id: role.id
    },
    data: {
      permissions: { set: permissionIds }
    }
  })
}
bootstrap()

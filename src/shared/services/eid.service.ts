import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { RoleName } from '~/shared/constants/auth.constant'
import { PrismaService } from '~/shared/services/prisma.service'

@Injectable()
export class EidService {
  // Map từ role hệ thống -> prefix của EID
  // VD: TRAINER -> TR000001, TRAINEE -> TE000001
  private readonly rolePrefixMap: Record<string, string> = {
    [RoleName.ADMINISTRATOR]: 'AD',
    [RoleName.DEPARTMENT_HEAD]: 'DH',
    [RoleName.SQA_AUDITOR]: 'QA',
    [RoleName.TRAINER]: 'TR',
    [RoleName.TRAINEE]: 'TE',
    [RoleName.ACADEMIC_DEPARTMENT]: 'AC'
  }

  // Prefix fallback cho các role không nằm trong map trên
  private readonly FALLBACK_PREFIX = 'AV'

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sinh EID mới cho role tương ứng.
   *
   * - EID format: <PREFIX><NUMBER>, ví dụ: TR000001, TE000010
   * - PREFIX dựa theo roleName (rolePrefixMap), không có thì dùng FALLBACK_PREFIX.
   * - NUMBER là số tăng dần, 6 chữ số, padding '0' ở bên trái.
   * - Nếu không truyền count -> trả về 1 EID (string).
   * - Nếu truyền count -> trả về mảng EID (string[]), dùng cho bulk create.
   */
  async generateEid({ roleName, count }: { roleName: string; count?: number }): Promise<string | string[]> {
    // 1. Xác định prefix theo role, nếu role không có trong map thì dùng fallback
    const prefix = this.rolePrefixMap[roleName] || this.FALLBACK_PREFIX

    // 2. Dùng transaction để tránh race condition khi nhiều request cùng sinh EID
    return await this.prisma.$transaction(async ({ user }: Prisma.TransactionClient) => {
      // 2.1. Tìm user có EID lớn nhất với prefix này
      //      - where: eid bắt đầu bằng prefix
      //      - orderBy desc: EID lớn nhất nằm trên cùng
      //      - select eid: chỉ lấy trường cần thiết, tránh load thừa
      const lastUser = await user.findFirst({
        where: { eid: { startsWith: prefix } },
        orderBy: { eid: 'desc' },
        select: { eid: true }
      })

      // 3. Tính số thứ tự tiếp theo
      let nextNumber = 1

      if (lastUser && lastUser.eid) {
        // Cắt bỏ prefix, lấy phần số đằng sau
        // Ví dụ: 'TR000010' -> prefix 'TR' (length = 2) -> substring(2) = '000010'
        const currentNumber = parseInt(lastUser.eid.substring(prefix.length), 10)
        // Số tiếp theo = số hiện tại + 1
        nextNumber = currentNumber + 1
      }

      // 4. Nếu không truyền count -> sinh 1 EID
      if (!count) {
        const eid = `${prefix}${nextNumber.toString().padStart(6, '0')}`
        return eid
      }

      // 5. Nếu có count -> sinh count EID liên tiếp, dùng chung prefix
      const eids: string[] = []

      for (let i = 0; i < count; i++) {
        const number = nextNumber + i
        const eid = `${prefix}${number.toString().padStart(6, '0')}` // padding 6 chữ số
        eids.push(eid)
      }

      return eids
    })
  }

  /**
   * Kiểm tra 1 EID có phù hợp với role hay không (dựa trên prefix).
   *
   * - Lấy prefix mong đợi từ rolePrefixMap (hoặc FALLBACK_PREFIX).
   * - So sánh eid.startsWith(prefix).
   */
  isEidMatchingRole(eid: string, roleName: string): boolean {
    const expectedPrefix = this.rolePrefixMap[roleName] || this.FALLBACK_PREFIX
    return eid.startsWith(expectedPrefix)
  }
}

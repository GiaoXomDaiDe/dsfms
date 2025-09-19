import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcrypt'

const saltRounds = 10

@Injectable()
export class HashingService {
  hashPassword(password: string): Promise<string> {
    return hash(password, saltRounds)
  }

  comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return compare(password, hashedPassword)
  }
}

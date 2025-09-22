export interface AccessTokenPayloadCreate {
  userId: string
  roleId: string
  roleName: string
}

export interface AccessTokenPayload extends AccessTokenPayloadCreate {
  iat: number
  exp: number
}

export interface RefreshTokenPayloadCreate {
  userId: number
}

export interface RefreshTokenPayload extends RefreshTokenPayloadCreate {
  iat: number
  exp: number
}

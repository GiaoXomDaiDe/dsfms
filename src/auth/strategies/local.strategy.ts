import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { AuthService } from "../auth.service";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as constant from '~/shared/constants/api/auth';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy){
    constructor(private authService: AuthService){
        super({
            usernameField: 'email',
            passwordField: 'password'
        });
    }

    async validate(email: string, password: string): Promise<any>{
        const token = await this.authService.validateUser({email, password});
        if(!token) {
            throw new UnauthorizedException(constant.MESSAGES[401]);
        }
        return token;
    }
}
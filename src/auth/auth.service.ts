import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthPayloadDto } from '~/dto/auth.dto';

//nhớ xóa cái này lần sau
const fakers = [{
    userId: "1",
    email: "phuongdubu@gmail.com",
    password: "123123",
    name: "Hong Phuc",
    role: "admin"
    },
    {
    userId: "2",
    email: "phuchonghanh@gmail.com",
    password: "123123",
    name: "Linka",
    role: "trainee"
    },
    {
    userId: "3",
    email: "vinhkunne@gmail.com",
    password: "123123",
    name: "Nguyen Quoc Vinh",
    role: "huh"
    }]

@Injectable()
export class AuthService {
    constructor(private jwtService: JwtService){}

    async validateUser({email, password}: AuthPayloadDto){
        const user = fakers.find(u => u.email === email && u.password === password);
        if(!user) return null;
        //return user without password for security
        const {password: userPassword, ...userInfo} = user;
        return {
            access_token: this.jwtService.sign(userInfo),
        };
    }
}

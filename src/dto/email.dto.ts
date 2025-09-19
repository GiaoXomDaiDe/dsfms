import { IsEmail, IsString, IsOptional, IsArray } from 'class-validator';

export class SendEmailDto {
    @IsEmail()
    to: string;

    @IsOptional()
    @IsArray()
    @IsEmail({}, { each: true })
    cc?: string[];

    @IsOptional()
    @IsArray()
    @IsEmail({}, { each: true })
    bcc?: string[];

    @IsString()
    subject: string;

    @IsOptional()
    @IsString()
    textBody?: string;

    @IsOptional()
    @IsString()
    htmlBody?: string;

    @IsOptional()
    @IsEmail()
    from?: string;

    @IsOptional()
    @IsEmail()
    replyTo?: string;
}

export class BulkEmailDto {
    @IsArray()
    @IsEmail({}, { each: true })
    recipients: string[];

    @IsString()
    subject: string;

    @IsOptional()
    @IsString()
    textBody?: string;

    @IsOptional()
    @IsString()
    htmlBody?: string;

    @IsOptional()
    @IsEmail()
    from?: string;
}
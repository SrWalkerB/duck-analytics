import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../lib/prisma/prisma.service';
import type { SignUpDto } from './dto/sign-up.dto';
import type { SignInDto } from './dto/sign-in.dto';
import {
  defaultLocale,
  type SupportedLocale,
} from './dto/auth-locale';
import {
  updateUserPreferencesSchema,
  type UpdateUserPreferencesDto,
} from './dto/update-user-preferences.dto';
import { signUpSchema } from './dto/sign-up.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signUp(dto: SignUpDto) {
    const parsed = signUpSchema.parse(dto);
    const existing = await this.prisma.user.findUnique({
      where: { email: parsed.email },
    });
    if (existing) throw new ConflictException('Email already in use');
    const hashed = await bcrypt.hash(parsed.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: parsed.email,
        password: hashed,
        name: parsed.name,
        locale: parsed.locale ?? defaultLocale,
      },
    });
    return this.createAuthResponse(user);
  }

  async signIn(dto: SignInDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.createAuthResponse(user);
  }

  async me(userId: string) {
    try {
      return await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.rethrowMissingUserAsUnauthorized(error);
      throw error;
    }
  }

  async updatePreferences(userId: string, dto: UpdateUserPreferencesDto) {
    const parsed = updateUserPreferencesSchema.parse(dto);

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { locale: parsed.locale },
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.rethrowMissingUserAsUnauthorized(error);
      throw error;
    }
  }

  private createAuthResponse(user: {
    id: string;
    email: string;
    name: string;
    locale?: string | null;
  }) {
    const locale = this.normalizeLocale(user.locale);
    const token = this.jwt.sign({ sub: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        locale,
      },
    };
  }

  private normalizeLocale(locale?: string | null): SupportedLocale {
    if (locale === 'en' || locale === 'es' || locale === 'pt-BR') return locale;
    return defaultLocale;
  }

  private rethrowMissingUserAsUnauthorized(error: unknown): never | void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      throw new UnauthorizedException('Invalid session');
    }
  }
}

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { SignInDto } from './dto/sign-in.dto';
import type { SignUpDto } from './dto/sign-up.dto';

process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5671/test';
process.env.JWT_SECRET ??= 'test-secret';
process.env.ENCRYPTION_KEY ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const { AuthService } = require('./auth.service') as typeof import('./auth.service');

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const jwt = { sign: jest.fn(() => 'signed-token') } as unknown as JwtService;

  let service: InstanceType<typeof AuthService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma as never, jwt);
  });

  it('signs up with the provided locale', async () => {
    const dto: SignUpDto = {
      name: 'Ada',
      email: 'ada@example.com',
      password: 'secret123',
      locale: 'es',
    };

    prisma.user.findUnique.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: dto.email,
      name: dto.name,
      locale: 'es',
    });

    await expect(service.signUp(dto)).resolves.toEqual({
      token: 'signed-token',
      user: {
        id: 'user-1',
        email: dto.email,
        name: dto.name,
        locale: 'es',
      },
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: dto.email,
        password: 'hashed-password',
        name: dto.name,
        locale: 'es',
      },
    });
  });

  it('defaults locale to pt-BR during sign up', async () => {
    const dto = {
      name: 'Ada',
      email: 'ada@example.com',
      password: 'secret123',
    } satisfies SignUpDto;

    prisma.user.findUnique.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: dto.email,
      name: dto.name,
      locale: 'pt-BR',
    });

    await service.signUp(dto);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: dto.email,
        password: 'hashed-password',
        name: dto.name,
        locale: 'pt-BR',
      },
    });
  });

  it('returns locale during sign in', async () => {
    const dto: SignInDto = { email: 'ada@example.com', password: 'secret123' };

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: dto.email,
      name: 'Ada',
      password: 'stored-hash',
      locale: 'en',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(service.signIn(dto)).resolves.toEqual({
      token: 'signed-token',
      user: {
        id: 'user-1',
        email: dto.email,
        name: 'Ada',
        locale: 'en',
      },
    });
  });

  it('returns locale in me()', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada',
      locale: 'es',
      createdAt: new Date('2026-04-13T12:00:00Z'),
    });

    await expect(service.me('user-1')).resolves.toMatchObject({
      id: 'user-1',
      locale: 'es',
    });

    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, email: true, name: true, locale: true, createdAt: true },
    });
  });

  it('updates locale preference', async () => {
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada',
      locale: 'en',
      createdAt: new Date('2026-04-13T12:00:00Z'),
    });

    await expect(service.updatePreferences('user-1', { locale: 'en' })).resolves.toMatchObject({
      id: 'user-1',
      locale: 'en',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { locale: 'en' },
      select: { id: true, email: true, name: true, locale: true, createdAt: true },
    });
  });

  it('rejects duplicate sign up emails', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await expect(
      service.signUp({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'secret123',
        locale: 'pt-BR',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'ada@example.com',
      name: 'Ada',
      password: 'stored-hash',
      locale: 'pt-BR',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.signIn({ email: 'ada@example.com', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

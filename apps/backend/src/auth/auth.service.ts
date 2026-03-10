import { Injectable, UnauthorizedException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from './types/roles.enum';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private configService: ConfigService,
  ) { }

  async register(registerDto: RegisterDto) {
    const { email, password, name, tenantName } = registerDto;

    // Check if tenant already exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { email },
    });

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existingTenant || existingUser) {
      // Use generic error message to prevent user enumeration
      throw new ConflictException('Registration failed. Please try again later or use different credentials.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create tenant and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          email,
        },
      });

      // Calculate trial ends at (5 days from now)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 5);

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || null,
          tenantId: tenant.id,
          role: UserRole.ADMIN,
          trialStartedAt: new Date(),
          trialEndsAt: trialEndsAt,
          licenseStatus: 'TRIAL',
        } as any, // Type assertion needed until TypeScript reloads Prisma types
      });

      return { tenant, user };
    });

    // Generate tokens
    const tokens = await this.generateTokens(result.user.id, result.tenant.id, result.user.email, (result.user as any).role || UserRole.ADMIN);

    return {
      ...tokens,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        tenantId: result.tenant.id,
        role: (result.user as any).role || UserRole.ADMIN,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        email: result.tenant.email,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Check if tenant is active
    if (!user.tenant.isActive) {
      throw new UnauthorizedException('Tenant account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Initialize trial if not set (for existing users or first login)
    if (!(user as any).trialStartedAt) {
      const trialStartedAt = new Date();
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialStartedAt.getDate() + 5);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          trialStartedAt,
          trialEndsAt,
          licenseStatus: 'TRIAL',
        } as any,
      });

      // Update local object for the token payload
      (user as any).trialStartedAt = trialStartedAt;
      (user as any).trialEndsAt = trialEndsAt;
      (user as any).licenseStatus = 'TRIAL';
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.tenantId, user.email, (user as any).role || UserRole.ADMIN);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: (user as any).role || UserRole.ADMIN,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        email: user.tenant.email,
      },
    };
  }

  /**
   * Generates Access and Refresh tokens with rotation strategy
   */
  async generateTokens(userId: string, tenantId: string, email: string, role: string) {
    const payload = { sub: userId, email, tenantId, role };
    const refreshTokenId = uuidv4();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(
        { ...payload, rtid: refreshTokenId },
        {
          expiresIn: this.configService.get<string>('JWT_REFRESH_TTL', '7d') as any,
          secret: this.configService.get<string>('JWT_REFRESH_SECRET') || this.configService.get<string>('JWT_SECRET')
        }
      ),
    ]);

    // Store refresh token metadata in Redis for rotation/revocation
    const ttl = 7 * 24 * 60 * 60; // default 7 days in seconds
    await this.redisService.setWithTTL(`auth:refresh:${userId}:${refreshTokenId}`, '1', ttl);

    return { accessToken, refreshToken };
  }

  /**
   * Refreshes access token and rotates the refresh token
   */
  async refresh(oldRefreshToken: string) {
    try {
      const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: refreshSecret
      });

      const { sub: userId, tenantId, email, role, rtid: refreshTokenId } = payload;

      // Check if this refresh token is still valid in Redis
      const redisKey = `auth:refresh:${userId}:${refreshTokenId}`;
      const isValid = await this.redisService.exists(redisKey);

      if (!isValid) {
        // Potential reuse attack!
        // Security best practice: Revoke all refresh tokens for this user
        await this.revokeAllUserTokens(userId);
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Revoke the used refresh token (rotation)
      await this.redisService.delete(redisKey);

      // Generate new tokens
      return this.generateTokens(userId, tenantId, email, role);
    } catch (e) {
      throw new UnauthorizedException('Session expired');
    }
  }

  async logout(userId: string, refreshTokenId?: string) {
    if (refreshTokenId) {
      await this.redisService.delete(`auth:refresh:${userId}:${refreshTokenId}`);
    } else {
      await this.revokeAllUserTokens(userId);
    }
  }

  private async asyncDeleteKeys(pattern: string) {
    const redis = this.redisService.getClient();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  async revokeAllUserTokens(userId: string) {
    await this.asyncDeleteKeys(`auth:refresh:${userId}:*`);
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }
}


import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from './types/roles.enum';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  async register(registerDto: RegisterDto) {
    const { email, password, name, tenantName } = registerDto;

    // Check if tenant already exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { email },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant with this email already exists');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
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

    // Generate JWT token
    const payload = {
      sub: result.user.id,
      email: result.user.email,
      tenantId: result.tenant.id,
      role: (result.user as any).role || UserRole.ADMIN,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
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

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: (user as any).role || UserRole.ADMIN,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
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

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user || !user.isActive || !user.tenant.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      role: (user as any).role || UserRole.ADMIN,
      licenseStatus: (user as any).licenseStatus,
      trialStartedAt: (user as any).trialStartedAt,
      trialEndsAt: (user as any).trialEndsAt,
      licenseExpiresAt: (user as any).licenseExpiresAt,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        email: user.tenant.email,
      },
    };
  }
}


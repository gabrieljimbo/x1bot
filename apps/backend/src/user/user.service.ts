import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../auth/types/roles.enum';

export interface CreateUserDto {
  email: string;
  password: string;
  name?: string;
  tenantId: string;
  role?: UserRole;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  name?: string;
  isActive?: boolean;
  role?: UserRole;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) { }

  async findAll(requesterRole: UserRole, requesterTenantId?: string) {
    // SUPER_ADMIN can see all users
    if (requesterRole === UserRole.SUPER_ADMIN) {
      return this.prisma.user.findMany({
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    // ADMIN can only see users from their tenant
    if (requesterTenantId) {
      return this.prisma.user.findMany({
        where: {
          tenantId: requesterTenantId,
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    return [];
  }

  async findOne(id: string, requesterRole: UserRole, requesterTenantId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ADMIN can only access users from their tenant
    if (requesterRole === UserRole.ADMIN && user.tenantId !== requesterTenantId) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(createUserDto: CreateUserDto, requesterRole: UserRole) {
    // Only SUPER_ADMIN can create users
    if (requesterRole !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Only super admin can create users');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: createUserDto.email,
        tenantId: createUserDto.tenantId,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists in this tenant');
    }

    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: createUserDto.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Calculate trial ends at (5 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 5);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        name: createUserDto.name || null,
        tenantId: createUserDto.tenantId,
        role: (createUserDto.role as any) || (UserRole.USER as any),
        trialStartedAt: new Date(),
        trialEndsAt: trialEndsAt,
        licenseStatus: 'TRIAL',
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    requesterRole: UserRole,
    requesterTenantId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ADMIN can only update users from their tenant
    if (requesterRole === UserRole.ADMIN && user.tenantId !== requesterTenantId) {
      throw new NotFoundException('User not found');
    }

    // Only SUPER_ADMIN can change roles
    if (updateUserDto.role && requesterRole !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Only super admin can change user roles');
    }

    // Check email uniqueness if updating email
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: updateUserDto.email,
          tenantId: user.tenantId,
        },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists in this tenant');
      }
    }

    // Hash password if updating
    const updateData: any = { ...updateUserDto };
    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async remove(id: string, requesterRole: UserRole, requesterTenantId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ADMIN can only remove users from their tenant
    if (requesterRole === UserRole.ADMIN && user.tenantId !== requesterTenantId) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  async getLicenses(requesterRole: UserRole) {
    if (requesterRole !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Only super admin can access license list');
    }

    const users = await this.prisma.user.findMany({
      include: {
        tenant: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const now = new Date();

    return users.map((user) => {
      let daysRemaining = 0;
      if (user.role === UserRole.VIP && user.licenseExpiresAt) {
        daysRemaining = Math.max(
          0,
          Math.ceil(
            (new Date(user.licenseExpiresAt).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
          ),
        );
      } else if (user.role === UserRole.USER && user.trialEndsAt) {
        daysRemaining = Math.max(
          0,
          Math.ceil(
            (new Date(user.trialEndsAt).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
          ),
        );
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        licenseStatus: user.licenseStatus,
        trialEndsAt: user.trialEndsAt,
        licenseExpiresAt: user.licenseExpiresAt,
        daysRestantes: daysRemaining,
        tenantName: user.tenant.name,
      };
    });
  }

  async updateLicense(
    id: string,
    updateLicenseDto: {
      role: UserRole;
      licenseStatus: string;
      licenseExpiresAt?: string;
    },
    requesterRole: UserRole,
  ) {
    if (requesterRole !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Only super admin can update licenses');
    }

    const data: any = {
      role: updateLicenseDto.role,
      licenseStatus: updateLicenseDto.licenseStatus,
    };

    if (updateLicenseDto.licenseExpiresAt) {
      data.licenseExpiresAt = new Date(updateLicenseDto.licenseExpiresAt);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    return user;
  }
}


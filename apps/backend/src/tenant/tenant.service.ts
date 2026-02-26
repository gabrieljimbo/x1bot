import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTenantDto {
  name: string;
  email: string;
}

export interface UpdateTenantDto {
  name?: string;
  email?: string;
  isActive?: boolean;
}

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    return this.prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            workflows: true,
            whatsappSessions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
            role: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            workflows: true,
            whatsappSessions: true,
            workflowExecutions: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async create(createTenantDto: CreateTenantDto) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { email: createTenantDto.email },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant with this email already exists');
    }

    return this.prisma.tenant.create({
      data: {
        name: createTenantDto.name,
        email: createTenantDto.email,
      },
    });
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (updateTenantDto.email && updateTenantDto.email !== tenant.email) {
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { email: updateTenantDto.email },
      });

      if (existingTenant) {
        throw new ConflictException('Tenant with this email already exists');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });
  }

  async remove(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    await this.prisma.tenant.delete({
      where: { id },
    });

    return { message: 'Tenant deleted successfully' };
  }
}


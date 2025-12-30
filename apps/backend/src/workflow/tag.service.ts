import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTagDto {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateTagDto {
  name?: string;
  color?: string;
  description?: string;
}

@Injectable()
export class TagService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all tags for a tenant
   */
  async getTags(tenantId: string) {
    return this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get a single tag by ID
   */
  async getTag(tenantId: string, id: string) {
    return this.prisma.tag.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Create a new tag
   */
  async createTag(tenantId: string, data: CreateTagDto) {
    // Check if tag with same name already exists
    const existing = await this.prisma.tag.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new Error('Tag with this name already exists');
    }

    return this.prisma.tag.create({
      data: {
        tenantId,
        name: data.name,
        color: data.color || '#8b5cf6',
        description: data.description,
      },
    });
  }

  /**
   * Update a tag
   */
  async updateTag(tenantId: string, id: string, data: UpdateTagDto) {
    // Check if tag exists
    const tag = await this.getTag(tenantId, id);
    if (!tag) {
      throw new Error('Tag not found');
    }

    // If changing name, check if new name already exists
    if (data.name && data.name !== tag.name) {
      const existing = await this.prisma.tag.findUnique({
        where: {
          tenantId_name: {
            tenantId,
            name: data.name,
          },
        },
      });

      if (existing) {
        throw new Error('Tag with this name already exists');
      }
    }

    return this.prisma.tag.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete a tag
   */
  async deleteTag(tenantId: string, id: string) {
    // Check if tag exists
    const tag = await this.getTag(tenantId, id);
    if (!tag) {
      throw new Error('Tag not found');
    }

    // TODO: Optionally remove this tag from all contacts
    // For now, we'll just delete the tag definition

    return this.prisma.tag.delete({
      where: { id },
    });
  }

  /**
   * Get tag usage count (how many contacts have this tag)
   */
  async getTagUsageCount(tenantId: string, tagName: string): Promise<number> {
    const contactTags = await this.prisma.contactTag.findMany({
      where: {
        tenantId,
        tags: {
          has: tagName,
        },
      },
    });

    return contactTags.length;
  }
}




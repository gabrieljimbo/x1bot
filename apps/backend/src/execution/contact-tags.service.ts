import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContactTagsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get tags for a contact
   */
  async getTags(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
  ): Promise<string[]> {
    const record = await this.prisma.contactTag.findUnique({
      where: {
        tenantId_sessionId_contactPhone: {
          tenantId,
          sessionId,
          contactPhone,
        },
      },
    });

    return record?.tags || [];
  }

  /**
   * Add tags to a contact
   */
  async addTags(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
    tagsToAdd: string[],
  ): Promise<string[]> {
    const currentTags = await this.getTags(tenantId, sessionId, contactPhone);
    const newTags = [...new Set([...currentTags, ...tagsToAdd])]; // Remove duplicates

    await this.prisma.contactTag.upsert({
      where: {
        tenantId_sessionId_contactPhone: {
          tenantId,
          sessionId,
          contactPhone,
        },
      },
      create: {
        tenantId,
        sessionId,
        contactPhone,
        tags: newTags,
      },
      update: {
        tags: newTags,
        updatedAt: new Date(),
      },
    });

    return newTags;
  }

  /**
   * Remove tags from a contact
   */
  async removeTags(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
    tagsToRemove: string[],
  ): Promise<string[]> {
    const currentTags = await this.getTags(tenantId, sessionId, contactPhone);
    const newTags = currentTags.filter((tag) => !tagsToRemove.includes(tag));

    await this.prisma.contactTag.upsert({
      where: {
        tenantId_sessionId_contactPhone: {
          tenantId,
          sessionId,
          contactPhone,
        },
      },
      create: {
        tenantId,
        sessionId,
        contactPhone,
        tags: newTags,
      },
      update: {
        tags: newTags,
        updatedAt: new Date(),
      },
    });

    return newTags;
  }

  /**
   * Set tags (replace all existing tags)
   */
  async setTags(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
    tags: string[],
  ): Promise<string[]> {
    const uniqueTags = [...new Set(tags)]; // Remove duplicates

    await this.prisma.contactTag.upsert({
      where: {
        tenantId_sessionId_contactPhone: {
          tenantId,
          sessionId,
          contactPhone,
        },
      },
      create: {
        tenantId,
        sessionId,
        contactPhone,
        tags: uniqueTags,
      },
      update: {
        tags: uniqueTags,
        updatedAt: new Date(),
      },
    });

    return uniqueTags;
  }

  /**
   * Clear all tags from a contact
   */
  async clearTags(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
  ): Promise<void> {
    await this.prisma.contactTag.upsert({
      where: {
        tenantId_sessionId_contactPhone: {
          tenantId,
          sessionId,
          contactPhone,
        },
      },
      create: {
        tenantId,
        sessionId,
        contactPhone,
        tags: [],
      },
      update: {
        tags: [],
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Check if contact has a specific tag
   */
  async hasTag(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
    tag: string,
  ): Promise<boolean> {
    const tags = await this.getTags(tenantId, sessionId, contactPhone);
    return tags.includes(tag);
  }

  /**
   * Check if contact has any of the specified tags
   */
  async hasAnyTag(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
    tagsToCheck: string[],
  ): Promise<boolean> {
    const tags = await this.getTags(tenantId, sessionId, contactPhone);
    return tagsToCheck.some((tag) => tags.includes(tag));
  }

  /**
   * Check if contact has all of the specified tags
   */
  async hasAllTags(
    tenantId: string,
    sessionId: string,
    contactPhone: string,
    tagsToCheck: string[],
  ): Promise<boolean> {
    const tags = await this.getTags(tenantId, sessionId, contactPhone);
    return tagsToCheck.every((tag) => tags.includes(tag));
  }
}


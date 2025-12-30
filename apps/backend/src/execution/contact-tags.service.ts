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
    contactId: string,
  ): Promise<string[]> {
    console.log('[ContactTagsService] getTags called with:', { tenantId, sessionId, contactId });
    const record = await this.prisma.contactTag.findUnique({
      where: {
        tenantId_sessionId_contactId: {
          tenantId,
          sessionId,
          contactId,
        },
      },
    });
    console.log('[ContactTagsService] Found record:', record);

    return record?.tags || [];
  }

  /**
   * Add tags to a contact
   */
  async addTags(
    tenantId: string,
    sessionId: string,
    contactId: string,
    tagsToAdd: string[],
  ): Promise<string[]> {
    const currentTags = await this.getTags(tenantId, sessionId, contactId);
    const newTags = [...new Set([...currentTags, ...tagsToAdd])]; // Remove duplicates

    await this.prisma.contactTag.upsert({
      where: {
        tenantId_sessionId_contactId: {
          tenantId,
          sessionId,
          contactId,
        },
      },
      create: {
        tenantId,
        sessionId,
        contactId,
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
    contactId: string,
    tagsToRemove: string[],
  ): Promise<string[]> {
    const currentTags = await this.getTags(tenantId, sessionId, contactId);
    const newTags = currentTags.filter((tag) => !tagsToRemove.includes(tag));

    await this.prisma.contactTag.upsert({
      where: {
        tenantId_sessionId_contactId: {
          tenantId,
          sessionId,
          contactId,
        },
      },
      create: {
        tenantId,
        sessionId,
        contactId,
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
    contactId: string,
    tags: string[],
  ): Promise<string[]> {
    const uniqueTags = [...new Set(tags)]; // Remove duplicates

    await this.prisma.contactTag.upsert({
      where: {
        tenantId_sessionId_contactId: {
          tenantId,
          sessionId,
          contactId,
        },
      },
      create: {
        tenantId,
        sessionId,
        contactId,
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
    contactId: string,
  ): Promise<void> {
    await this.prisma.contactTag.upsert({
      where: {
        tenantId_sessionId_contactId: {
          tenantId,
          sessionId,
          contactId,
        },
      },
      create: {
        tenantId,
        sessionId,
        contactId,
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
    contactId: string,
    tag: string,
  ): Promise<boolean> {
    const tags = await this.getTags(tenantId, sessionId, contactId);
    return tags.includes(tag);
  }

  /**
   * Check if contact has any of the specified tags
   */
  async hasAnyTag(
    tenantId: string,
    sessionId: string,
    contactId: string,
    tagsToCheck: string[],
  ): Promise<boolean> {
    const tags = await this.getTags(tenantId, sessionId, contactId);
    return tagsToCheck.some((tag) => tags.includes(tag));
  }

  /**
   * Check if contact has all of the specified tags
   */
  async hasAllTags(
    tenantId: string,
    sessionId: string,
    contactId: string,
    tagsToCheck: string[],
  ): Promise<boolean> {
    const tags = await this.getTags(tenantId, sessionId, contactId);
    return tagsToCheck.every((tag) => tags.includes(tag));
  }
}


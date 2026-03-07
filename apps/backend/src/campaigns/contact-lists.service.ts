import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContactListsService {
  constructor(private readonly prisma: PrismaService) {}

  async createList(tenantId: string, dto: { name: string; description?: string }) {
    return this.prisma.contactList.create({
      data: { tenantId, name: dto.name, description: dto.description },
    });
  }

  async updateList(tenantId: string, listId: string, dto: { name?: string; description?: string }) {
    await this.assertListBelongs(tenantId, listId);
    return this.prisma.contactList.update({ where: { id: listId }, data: dto });
  }

  async deleteList(tenantId: string, listId: string) {
    await this.assertListBelongs(tenantId, listId);
    await this.prisma.contactList.delete({ where: { id: listId } });
    return { success: true };
  }

  async getLists(tenantId: string) {
    return this.prisma.contactList.findMany({
      where: { tenantId },
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getListById(tenantId: string, listId: string) {
    const list = await this.prisma.contactList.findFirst({
      where: { id: listId, tenantId },
      include: { contacts: { orderBy: { createdAt: 'desc' } } },
    });
    if (!list) throw new NotFoundException('Contact list not found');
    return list;
  }

  async addContactsFromCsv(listId: string, csvContent: string) {
    const lines = csvContent.split('\n').map((l) => l.trim()).filter(Boolean);
    const contacts: { phone: string; name?: string }[] = [];
    for (const line of lines) {
      const [phone, name] = line.split(',').map((s) => s.trim());
      if (phone) contacts.push({ phone, name: name || undefined });
    }
    return this._addContacts(listId, contacts);
  }

  async addContactsFromInbox(listId: string, tenantId: string, filters: { tags?: string[] }) {
    const contactTags = await this.prisma.contactTag.findMany({
      where: {
        tenantId,
        ...(filters.tags && filters.tags.length > 0 ? { tags: { hasSome: filters.tags } } : {}),
      },
    });
    const contacts = [...new Set(contactTags.map((c) => c.contactPhone))].map((phone) => ({ phone }));
    return this._addContacts(listId, contacts);
  }

  async addContactsManually(listId: string, contacts: { phone: string; name?: string }[]) {
    return this._addContacts(listId, contacts);
  }

  async removeContact(listId: string, contactId: string) {
    await this.prisma.contactListItem.delete({ where: { id: contactId } });
    return { success: true };
  }

  private async _addContacts(listId: string, items: { phone: string; name?: string }[]) {
    const existing = await this.prisma.contactListItem.findMany({ where: { contactListId: listId }, select: { phone: true } });
    const existingPhones = new Set(existing.map((c) => c.phone));
    const newOnes = items.filter((i) => !existingPhones.has(i.phone));

    if (newOnes.length > 0) {
      await this.prisma.contactListItem.createMany({
        data: newOnes.map((c) => ({ contactListId: listId, phone: c.phone, name: c.name })),
      });
    }

    return { added: newOnes.length, total: existingPhones.size + newOnes.length };
  }

  private async assertListBelongs(tenantId: string, listId: string) {
    const list = await this.prisma.contactList.findFirst({ where: { id: listId, tenantId } });
    if (!list) throw new NotFoundException('Contact list not found');
    return list;
  }
}

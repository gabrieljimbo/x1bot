import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { ContactListsService } from './contact-lists.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignType } from '@prisma/client';

@Controller('api/campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly contactListsService: ContactListsService,
  ) {}

  // ─── CAMPAIGN CRUD ────────────────────────────────────────────────────────────

  @Post()
  createCampaign(@Request() req: any, @Body() body: any) {
    return this.campaignsService.createCampaign(req.user.tenantId, body);
  }

  @Get()
  getCampaigns(@Request() req: any, @Query('type') type?: string) {
    return this.campaignsService.getCampaigns(req.user.tenantId, type as CampaignType | undefined);
  }

  // Must come before /:id routes to avoid route collision
  @Get('blacklist')
  getBlacklist(@Request() req: any) {
    return this.campaignsService.getBlacklist(req.user.tenantId);
  }

  @Get('workflows')
  getCampaignWorkflows(@Request() req: any) {
    return this.campaignsService.getCampaignWorkflowsList(req.user.tenantId);
  }

  @Get('tags')
  getCampaignTags(@Request() req: any) {
    return this.campaignsService.getCampaignTags(req.user.tenantId);
  }

  @Get('whatsapp-labels')
  getCampaignWhatsappLabels(@Request() req: any) {
    return this.campaignsService.getCampaignWhatsappLabels(req.user.tenantId);
  }

  @Post('blacklist')
  addToBlacklist(@Request() req: any, @Body() body: { phone: string; reason?: string }) {
    return this.campaignsService.addToBlacklist(req.user.tenantId, body.phone, body.reason);
  }

  @Delete('blacklist/:phone')
  removeFromBlacklist(@Request() req: any, @Param('phone') phone: string) {
    return this.campaignsService.removeFromBlacklist(req.user.tenantId, phone);
  }

  @Get(':id')
  getCampaign(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.getCampaignById(req.user.tenantId, id);
  }

  @Put(':id')
  updateCampaign(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.campaignsService.updateCampaign(req.user.tenantId, id, body);
  }

  @Delete(':id')
  deleteCampaign(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.deleteCampaign(req.user.tenantId, id);
  }

  // ─── ACTIONS ─────────────────────────────────────────────────────────────────

  @Post(':id/start')
  startCampaign(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.startCampaign(req.user.tenantId, id);
  }

  @Post(':id/pause')
  pauseCampaign(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.pauseCampaign(req.user.tenantId, id);
  }

  @Post(':id/resume')
  resumeCampaign(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.resumeCampaign(req.user.tenantId, id);
  }

  @Get(':id/stats')
  async getCampaignStats(@Request() req: any, @Param('id') id: string) {
    await this.campaignsService.getCampaignById(req.user.tenantId, id);
    return this.campaignsService.getCampaignStats(id);
  }

  // ─── RECIPIENTS ──────────────────────────────────────────────────────────────

  @Post(':id/recipients/contacts')
  addFromContacts(@Request() req: any, @Param('id') id: string, @Body() body: { tags?: string[]; whatsappLabelIds?: string[] }) {
    return this.campaignsService.addRecipientsFromContacts(id, req.user.tenantId, { tags: body.tags, whatsappLabelIds: body.whatsappLabelIds });
  }

  @Post(':id/recipients/csv')
  addFromCsv(@Param('id') id: string, @Body() body: { csv: string }) {
    return this.campaignsService.addRecipientsFromCsv(id, body.csv);
  }

  @Post(':id/recipients/phones')
  addFromPhones(@Param('id') id: string, @Body() body: { phones: string[] }) {
    return this.campaignsService.addRecipientsFromPhones(id, body.phones);
  }

  @Post(':id/recipients/list')
  addFromList(@Param('id') id: string, @Body() body: { contactListId: string }) {
    return this.campaignsService.addRecipientsFromContactList(id, body.contactListId);
  }

  // ─── WORKFLOW ─────────────────────────────────────────────────────────────────

  @Get(':id/workflow')
  getWorkflow(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.getWorkflow(id, req.user.tenantId);
  }

  @Put(':id/workflow')
  saveWorkflow(@Request() req: any, @Param('id') id: string, @Body() body: { nodes: any[]; edges: any[] }) {
    return this.campaignsService.saveWorkflow(id, req.user.tenantId, body.nodes, body.edges);
  }
}

@Controller('api/contact-lists')
@UseGuards(JwtAuthGuard)
export class ContactListsController {
  constructor(private readonly contactListsService: ContactListsService) {}

  @Post()
  createList(@Request() req: any, @Body() body: { name: string; description?: string }) {
    return this.contactListsService.createList(req.user.tenantId, body);
  }

  @Get()
  getLists(@Request() req: any) {
    return this.contactListsService.getLists(req.user.tenantId);
  }

  @Get(':id')
  getList(@Request() req: any, @Param('id') id: string) {
    return this.contactListsService.getListById(req.user.tenantId, id);
  }

  @Put(':id')
  updateList(@Request() req: any, @Param('id') id: string, @Body() body: { name?: string; description?: string }) {
    return this.contactListsService.updateList(req.user.tenantId, id, body);
  }

  @Delete(':id')
  deleteList(@Request() req: any, @Param('id') id: string) {
    return this.contactListsService.deleteList(req.user.tenantId, id);
  }

  @Post(':id/contacts/csv')
  addFromCsv(@Param('id') id: string, @Body() body: { csv: string }) {
    return this.contactListsService.addContactsFromCsv(id, body.csv);
  }

  @Post(':id/contacts/inbox')
  addFromInbox(@Request() req: any, @Param('id') id: string, @Body() body: { tags?: string[] }) {
    return this.contactListsService.addContactsFromInbox(id, req.user.tenantId, { tags: body.tags });
  }

  @Post(':id/contacts/manual')
  addManually(@Param('id') id: string, @Body() body: { contacts: { phone: string; name?: string }[] }) {
    return this.contactListsService.addContactsManually(id, body.contacts);
  }

  @Delete(':id/contacts/:contactId')
  removeContact(@Param('id') _listId: string, @Param('contactId') contactId: string) {
    return this.contactListsService.removeContact(_listId, contactId);
  }
}

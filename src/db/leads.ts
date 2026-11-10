import { db } from './index.ts';
import { leads } from './schema.ts';
import { desc, eq } from 'drizzle-orm';

const inMemoryLeads = new Map<string, any>();

export async function getSavedLeads(userId?: string) {
  try {
    if (userId) {
      return await db.select().from(leads).where(eq(leads.userId, userId)).orderBy(desc(leads.createdAt));
    }
    return await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(50);
  } catch (error) {
    console.warn('Database unavailable, using in-memory leads cache:', (error as any)?.message);
    const all = Array.from(inMemoryLeads.values());
    if (userId) {
      return all
        .filter((l) => l.userId === userId)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    return all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }
}

export async function upsertLead(leadData: typeof leads.$inferInsert) {
  try {
    const result = await db
      .insert(leads)
      .values(leadData)
      .onConflictDoUpdate({
        target: leads.id,
        set: {
          status: leadData.status,
          recommendedPackageId: leadData.recommendedPackageId,
          fitScore: leadData.fitScore,
          notes: leadData.notes,
          updatedAt: new Date()
        }
      })
      .returning();
    return result[0];
  } catch (error) {
    console.warn('Database unavailable, caching lead in memory:', (error as any)?.message);
    const existing = inMemoryLeads.get(leadData.id) || {};
    const record = {
      ...existing,
      ...leadData,
      updatedAt: new Date(),
      createdAt: existing.createdAt || new Date()
    };
    inMemoryLeads.set(leadData.id, record);
    return record;
  }
}

export async function updateLeadStatus(leadId: string, status: string, notes?: string) {
  try {
    const result = await db
      .update(leads)
      .set({
        status,
        ...(notes !== undefined ? { notes } : {}),
        updatedAt: new Date()
      })
      .where(eq(leads.id, leadId))
      .returning();
    return result[0];
  } catch (error) {
    console.warn('Database unavailable, updating lead status in memory:', (error as any)?.message);
    const existing = inMemoryLeads.get(leadId) || { id: leadId, createdAt: new Date() };
    const updated = {
      ...existing,
      status,
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: new Date()
    };
    inMemoryLeads.set(leadId, updated);
    return updated;
  }
}

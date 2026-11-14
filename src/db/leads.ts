import { db } from './index.ts';
import { leads } from './schema.ts';
import { desc, eq } from 'drizzle-orm';

const inMemoryLeads = new Map<string, any>();

export async function getSavedLeads(userId?: string) {
  const readInMemory = () => {
    const all = Array.from(inMemoryLeads.values());
    if (userId) {
      return all
        .filter((l) => l.userId === userId)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    return all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  };

  if (!db) {
    return readInMemory();
  }

  try {
    if (userId) {
      return await db.select().from(leads).where(eq(leads.userId, userId)).orderBy(desc(leads.createdAt));
    }
    return await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(50);
  } catch (error) {
    console.warn('Database unavailable, using in-memory leads cache:', (error as any)?.message);
    return readInMemory();
  }
}

export async function upsertLead(leadData: typeof leads.$inferInsert) {
  const upsertInMemory = () => {
    const existing = inMemoryLeads.get(leadData.id) || {};
    const record = {
      ...existing,
      ...leadData,
      updatedAt: new Date(),
      createdAt: existing.createdAt || new Date()
    };
    inMemoryLeads.set(leadData.id, record);
    return record;
  };

  if (!db) {
    return upsertInMemory();
  }

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
    return upsertInMemory();
  }
}

export async function updateLeadStatus(leadId: string, status: string, notes?: string) {
  const updateInMemory = () => {
    const existing = inMemoryLeads.get(leadId) || { id: leadId, createdAt: new Date() };
    const updated = {
      ...existing,
      status,
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: new Date()
    };
    inMemoryLeads.set(leadId, updated);
    return updated;
  };

  if (!db) {
    return updateInMemory();
  }

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
    return updateInMemory();
  }
}

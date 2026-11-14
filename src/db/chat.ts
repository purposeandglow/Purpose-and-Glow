import { db } from './index.ts';
import { chatMessages } from './schema.ts';
import { asc, eq } from 'drizzle-orm';

const inMemoryChatMessages: any[] = [];

export async function getChatHistory(userId?: string) {
  const readInMemory = () => {
    if (userId) {
      return inMemoryChatMessages.filter((m) => m.userId === userId).slice(-50);
    }
    return inMemoryChatMessages.slice(-30);
  };

  if (!db) {
    return readInMemory();
  }

  try {
    if (userId) {
      return await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.userId, userId))
        .orderBy(asc(chatMessages.createdAt))
        .limit(50);
    }
    return await db.select().from(chatMessages).orderBy(asc(chatMessages.createdAt)).limit(30);
  } catch (error) {
    console.warn('Database unavailable, using in-memory chat history:', (error as any)?.message);
    return readInMemory();
  }
}

export async function saveChatMessage(message: typeof chatMessages.$inferInsert) {
  const saveInMemory = () => {
    const msg = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...message,
      createdAt: new Date()
    };
    inMemoryChatMessages.push(msg);
    return msg;
  };

  if (!db) {
    return saveInMemory();
  }

  try {
    const result = await db.insert(chatMessages).values(message).returning();
    return result[0];
  } catch (error) {
    console.warn('Database unavailable, storing chat message in memory:', (error as any)?.message);
    return saveInMemory();
  }
}

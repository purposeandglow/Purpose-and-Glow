import { db } from './index.ts';
import { users } from './schema.ts';

const inMemoryUsers = new Map<string, any>();

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
  photoUrl?: string
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
        photoUrl: photoUrl || null
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || null,
          photoUrl: photoUrl || null
        }
      })
      .returning();

    return result[0];
  } catch (error) {
    console.warn('Database unavailable, syncing user in-memory:', (error as any)?.message);
    const user = {
      uid,
      email,
      displayName: displayName || null,
      photoUrl: photoUrl || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    inMemoryUsers.set(uid, user);
    return user;
  }
}

import { AppContext } from '../core/types';
import { users } from '../db/schema';

// Gets a user's profile from the database, or creates one if it doesn't exist.
export const getUser = async (c: AppContext) => {
  // Placeholder for the authenticated user from Clerk middleware.
  const authUser = { id: 'user_placeholder_id', username: 'Guest' };

  // Get the database client from the context.
  const db = c.get('db');

  try {
    // Attempt to find the user in the database.
    let user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, authUser.id),
    });

    // If the user does not exist, create them.
    if (!user) {
      const newUser = {
        id: authUser.id,
        username: authUser.username,
      };
      // Use the 'users' table schema for the insert operation.
      const result = await db.insert(users).values(newUser).returning();
      user = result[0];
    }

    return c.json({ success: true, user });
  } catch (error) {
    console.error('Error in getUser:', error);
    return c.json({ success: false, error: 'Failed to get or create user' }, 500);
  }
};

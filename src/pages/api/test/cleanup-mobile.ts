import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/server/db';
import { users, properties, transactions, bankAccounts } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  // Require test secret to prevent unauthorized access
  const testSecret = process.env.E2E_TEST_SECRET;
  if (!testSecret || req.headers['x-test-secret'] !== testSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (user) {
      await db.delete(transactions).where(eq(transactions.userId, user.id));
      await db.delete(bankAccounts).where(eq(bankAccounts.userId, user.id));
      await db.delete(properties).where(eq(properties.userId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ error: 'Failed to cleanup test data' });
  }
}

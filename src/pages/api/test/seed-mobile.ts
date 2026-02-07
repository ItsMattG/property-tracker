import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { db } from '@/server/db';
import { users, properties, transactions, bankAccounts } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name, propertyCount = 3, pendingTransactionCount = 5 } = req.body;

  try {
    // Clean up existing test user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      await db.delete(transactions).where(eq(transactions.userId, existingUser.id));
      await db.delete(bankAccounts).where(eq(bankAccounts.userId, existingUser.id));
      await db.delete(properties).where(eq(properties.userId, existingUser.id));
      await db.delete(users).where(eq(users.id, existingUser.id));
    }

    // Create test user with mobile password hash
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    await db.insert(users).values({
      id: userId,
      email,
      name,
      mobilePasswordHash: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create properties
    const createdProperties = [];
    for (let i = 0; i < propertyCount; i++) {
      const propertyId = randomUUID();
      await db.insert(properties).values({
        id: propertyId,
        userId,
        address: `${100 + i} Test Street`,
        suburb: 'Sydney',
        state: 'NSW',
        postcode: '2000',
        purchasePrice: `${500000 + i * 100000}.00`,
        purchaseDate: '2024-01-15',
        entityName: 'Personal',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdProperties.push({ id: propertyId, address: `${100 + i} Test Street` });
    }

    // Create bank account for transactions
    const bankAccountId = randomUUID();
    if (createdProperties.length > 0) {
      await db.insert(bankAccounts).values({
        id: bankAccountId,
        userId,
        basiqConnectionId: `test_conn_${bankAccountId.slice(0, 8)}`,
        basiqAccountId: `test_acct_${bankAccountId.slice(0, 8)}`,
        institution: 'Test Bank',
        accountName: 'Test Account',
        accountNumberMasked: '****1234',
        accountType: 'transaction',
        isConnected: true,
        defaultPropertyId: createdProperties[0]?.id,
        lastSyncedAt: new Date(),
        createdAt: new Date(),
      });

      // Create pending transactions
      const createdTransactions = [];
      for (let i = 0; i < pendingTransactionCount; i++) {
        const txId = randomUUID();
        await db.insert(transactions).values({
          id: txId,
          userId,
          bankAccountId,
          basiqTransactionId: `test_txn_${txId.slice(0, 8)}`,
          description: `Test Transaction ${i + 1}`,
          amount: `-${(50 + i * 25).toFixed(2)}`,
          date: new Date().toISOString().split('T')[0],
          category: 'uncategorized',
          transactionType: 'expense',
          suggestedCategory: 'repairs_and_maintenance',
          suggestionConfidence: `${70 + i * 5}`,
          isDeductible: false,
          isVerified: false,
          propertyId: createdProperties[0]?.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        createdTransactions.push({ id: txId, description: `Test Transaction ${i + 1}` });
      }

      return res.status(200).json({
        user: { id: userId, email },
        properties: createdProperties,
        pendingTransactions: createdTransactions,
      });
    }

    return res.status(200).json({
      user: { id: userId, email },
      properties: createdProperties,
      pendingTransactions: [],
    });
  } catch (error) {
    console.error('Seed error:', error);
    return res.status(500).json({ error: 'Failed to seed test data' });
  }
}

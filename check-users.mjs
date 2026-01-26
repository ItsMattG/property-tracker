import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL);

const result = await client`SELECT email, mobile_password_hash IS NOT NULL as has_mobile_pw FROM users`;
console.log('Users in database:');
result.forEach(u => {
  console.log(`  - ${u.email} (has_mobile_pw: ${u.has_mobile_pw})`);
});

await client.end();

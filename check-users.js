import 'dotenv/config';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const res = await client.execute('SELECT id, username, role FROM users');
console.log(JSON.stringify(res.rows, null, 2));
process.exit(0);

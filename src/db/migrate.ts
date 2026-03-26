import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, closeDb } from './client.js';

async function main() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');
  await closeDb();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

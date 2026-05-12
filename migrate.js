import { migrateAllData } from './src/services/migrationService.js';

// Run migration
migrateAllData().then(() => {
  console.log('Migration script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
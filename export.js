import { supabase } from './src/integrations/supabase/client.js';
import fs from 'fs';

async function exportData() {
  console.log('Starting data export from Supabase...');

  const tables = [
    'profiles',
    'posts',
    'follows',
    'conversations',
    'messages',
    'likes',
    'comments',
    'notifications'
  ];

  for (const table of tables) {
    console.log(`Exporting ${table}...`);

    const { data, error } = await supabase
      .from(table)
      .select('*');

    if (error) {
      console.error(`Error exporting ${table}:`, error);
      continue;
    }

    fs.writeFileSync(`supabase-export-${table}.json`, JSON.stringify(data, null, 2));
    console.log(`Exported ${data.length} records from ${table}`);
  }

  console.log('Data export completed!');
}

// Run export
exportData().then(() => {
  console.log('Export script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
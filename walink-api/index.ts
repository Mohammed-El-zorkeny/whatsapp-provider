// Load environment first — must be before any other import
// that might access env vars (e.g. supabase client, redis)
import './src/config/env';

import app from './src/app';
import { env } from './src/config/env';

const { PORT } = env;

app.listen(PORT, () => {
  console.log(`\n🚀  WaLink API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Health:      http://localhost:${PORT}/health\n`);
});

const fs = require('fs');
let content = fs.readFileSync('src/index.ts', 'utf8');

if (!content.includes('createStatementRoute')) {
  content = content.replace(
    "import { createChatRoute } from './routes/chat.js';",
    "import { createChatRoute } from './routes/chat.js';\nimport { createStatementRoute } from './routes/statements.js';"
  );

  content = content.replace(
    "await createChatRoute(server, {",
    "await createStatementRoute(server, {\n      supabaseUrl: process.env.SUPABASE_URL!,\n      supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!\n    });\n    await createChatRoute(server, {"
  );
  fs.writeFileSync('src/index.ts', content);
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initDb, closeDb } from './db.js';
import { createBusGateway } from './bus/gateway.js';
import { createDispatcher } from './notifier/dispatcher.js';
import { startScheduler } from './scheduler.js';
import { registerSearchTools } from './tools/search.js';
import { registerArrivalTools } from './tools/arrival.js';
import { registerAlarmTools } from './tools/alarm.js';
import { registerPollTools } from './tools/poll.js';

async function main() {
  // 1. Initialize database (auto-migrate)
  await initDb();

  // 2. Create bus gateway
  const apiKey = process.env.KORBUS_DATA_API_KEY ?? '';
  const gateway = createBusGateway({
    seoulApiKey: apiKey,
    gyeonggiApiKey: apiKey,
  });

  // 3. Create notification dispatcher
  const dispatcher = createDispatcher({
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  });

  // 4. Create MCP server
  const server = new McpServer({
    name: 'korbus-mcp',
    version: '0.1.0',
  });

  // 5. Register tools
  registerSearchTools(server, gateway);
  registerArrivalTools(server, gateway);
  registerAlarmTools(server);
  registerPollTools(server, { gateway, dispatcher });

  // 6. Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[korbus-mcp] server started');

  // 7. Start scheduler
  const stopScheduler = startScheduler({ gateway, dispatcher });

  // 8. Graceful shutdown
  const shutdown = async () => {
    console.error('[korbus-mcp] shutting down...');
    stopScheduler();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[korbus-mcp] fatal:', err);
  process.exit(1);
});

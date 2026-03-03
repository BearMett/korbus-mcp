import path from 'node:path';
import { createBusGateway } from '../bus/gateway.js';
import { createDispatcher } from '../notifier/dispatcher.js';
import { registerKorbusTools } from './tools.js';
import { createKorbusService } from './service.js';

interface PluginAPI {
  pluginConfig: Record<string, unknown>;
  stateDir: string;
  registerTool(tool: unknown, options?: { optional?: boolean }): void;
  registerService(service: {
    id: string;
    start?: () => void | Promise<void>;
    stop?: () => void | Promise<void>;
  }): void;
}

function readConfig(api: PluginAPI) {
  const cfg = api.pluginConfig;

  const busApiKey = (process.env.BUS_API_KEY as string) ?? '';
  const seoulApiKey =
    (cfg.seoulApiKey as string) ||
    process.env.SEOUL_BUS_API_KEY ||
    busApiKey;
  const gyeonggiApiKey =
    (cfg.gyeonggiApiKey as string) ||
    process.env.GYEONGGI_BUS_API_KEY ||
    busApiKey;
  const telegramBotToken =
    (cfg.telegramBotToken as string) ||
    process.env.TELEGRAM_BOT_TOKEN ||
    undefined;

  const databasePath =
    (cfg.databasePath as string) ||
    path.join(api.stateDir, 'korbus.db');
  const databaseUrl = `file:${databasePath}`;

  const pollEnabled = (cfg.pollEnabled as boolean) ?? true;

  return { seoulApiKey, gyeonggiApiKey, telegramBotToken, databaseUrl, pollEnabled };
}

const plugin = {
  id: 'korbus',
  name: 'KorBus',
  description:
    'Korean bus arrival info, alarms, and notifications for Seoul and Gyeonggi',

  register(api: PluginAPI) {
    const config = readConfig(api);

    const gateway = createBusGateway({
      seoulApiKey: config.seoulApiKey,
      gyeonggiApiKey: config.gyeonggiApiKey,
    });

    const dispatcher = createDispatcher({
      telegramBotToken: config.telegramBotToken,
    });

    registerKorbusTools(api as any, { gateway, dispatcher });

    api.registerService(
      createKorbusService({ gateway, dispatcher }, {
        pollEnabled: config.pollEnabled,
        databaseUrl: config.databaseUrl,
      }),
    );
  },
};

export default plugin;

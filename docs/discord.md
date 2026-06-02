# Discord integration

`@openalpha/discord` ships a **complete command layer** (`src/commands.ts`) that reads live agent state and returns Discord embeds. The gateway connection is left to `discord.js` to keep the core install light.

## Wire it up

```bash
pnpm --filter @openalpha/discord add discord.js
```

In `apps/discord/src/bot.ts`:

```ts
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import { SLASH_COMMANDS, embedFor } from "./commands.ts";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);
  await rest.put(Routes.applicationCommands(client.application!.id), { body: SLASH_COMMANDS });
});

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  await i.reply({ embeds: [embedFor(i.commandName)] });
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

Commands: `/pnl`, `/positions`, `/risk`, `/strategies`, `/wallets`. Add more by extending `SLASH_COMMANDS` and `embedFor`.

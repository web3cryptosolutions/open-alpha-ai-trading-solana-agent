import { SLASH_COMMANDS, embedFor } from "./commands.ts";

/**
 * Discord integration. The command layer (src/commands.ts) is complete and
 * reads live agent state. The gateway connection needs `discord.js`, kept out
 * of the core install to stay lightweight:
 *
 *   pnpm --filter @openalpha/discord add discord.js
 *
 * Then in this file: create a Client, register SLASH_COMMANDS, and on each
 * interaction reply with `{ embeds: [embedFor(name)] }`. Full guide in
 * docs/discord.md. Until then this prints the wiring + a sample embed.
 */
const TOKEN = process.env.DISCORD_BOT_TOKEN;

console.log("◎ Open Alpha — Discord");
console.log(`Slash commands ready to register: ${SLASH_COMMANDS.map((c) => "/" + c.name).join(", ")}`);

if (!TOKEN) {
  console.log("\n⚠️  DISCORD_BOT_TOKEN not set. See docs/discord.md to connect the gateway.");
  console.log("\nSample /pnl embed from live state:\n");
  console.log(JSON.stringify(embedFor("pnl"), null, 2));
  process.exit(0);
}

console.log("\nTODO: connect discord.js gateway (see docs/discord.md). Command layer is ready.");

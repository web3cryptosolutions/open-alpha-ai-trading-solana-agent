import { handle } from "./commands.ts";

/**
 * Dependency-free Telegram bot using the HTTP Bot API + long polling. No
 * grammy, no webhooks, no infra — just `fetch`. Set TELEGRAM_BOT_TOKEN and run.
 */
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = (m: string) => `https://api.telegram.org/bot${TOKEN}/${m}`;

if (!TOKEN) {
  console.log(
    [
      "⚠️  TELEGRAM_BOT_TOKEN is not set.",
      "",
      "1. Create a bot with @BotFather and copy the token.",
      "2. Add TELEGRAM_BOT_TOKEN=... to your .env",
      "3. Run `pnpm --filter @openalpha/telegram dev`",
      "",
      "Commands are pure functions in src/commands.ts — here's /pnl right now:",
      "",
      handle("/pnl"),
    ].join("\n"),
  );
  process.exit(0);
}

interface TgUpdate {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
}

async function call(method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(API(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main(): Promise<void> {
  console.log("◎ Open Alpha Telegram bot — polling…");
  let offset = 0;
  for (;;) {
    try {
      const res = (await (await fetch(API(`getUpdates?timeout=30&offset=${offset}`))).json()) as {
        ok: boolean;
        result: TgUpdate[];
      };
      for (const u of res.result ?? []) {
        offset = u.update_id + 1;
        const text = u.message?.text;
        const chatId = u.message?.chat.id;
        if (!text || chatId === undefined) continue;
        const reply = handle(text);
        await call("sendMessage", { chat_id: chatId, text: reply, parse_mode: "Markdown" });
      }
    } catch (err) {
      console.error("poll error:", err instanceof Error ? err.message : err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

void main();

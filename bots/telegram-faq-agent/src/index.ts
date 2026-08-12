import { Bot, GrammyError, HttpError, type Context } from "grammy";
import { askTiredFaq } from "./ai.js";
import {
  FAQ_CHAT_IDS,
  FAQ_TOPIC_IDS,
  GIPHY_API_KEY,
  MENTION_CHAT_IDS,
  MIN_QUESTION_CHARS,
  MIN_TEXT_QUESTION_CHARS,
  USER_COOLDOWN_MS,
  requireToken,
} from "./config.js";
import { pickGifSearchQuery, searchGifUrl } from "./giphy.js";

const bot = new Bot(requireToken());
const lastReplyAt = new Map<number, number>();

function isFaqChat(chatId: number): boolean {
  return FAQ_CHAT_IDS.includes(String(chatId));
}

function isMentionChat(chatId: number): boolean {
  return MENTION_CHAT_IDS.includes(String(chatId));
}

function isFaqTopic(threadId: number | undefined): boolean {
  if (!FAQ_TOPIC_IDS.length) return true;
  if (threadId === undefined) return FAQ_TOPIC_IDS.includes("0");
  return FAQ_TOPIC_IDS.includes(String(threadId));
}

/** FAQ group = always listen. Main group = only when @bot tagged (or reply to bot). */
function shouldHandleMessage(ctx: Context): boolean {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) return false;

  if (isFaqChat(chatId)) {
    return isFaqTopic(ctx.message?.message_thread_id);
  }

  if (isMentionChat(chatId)) {
    return isBotAddressed(ctx);
  }

  return false;
}

function isBotAddressed(ctx: Context): boolean {
  const username = (ctx.me.username || "").toLowerCase();
  if (!username) return false;

  const msg = ctx.message;
  if (!msg) return false;

  // Reply to one of the bot's messages counts as tagging it
  if (msg.reply_to_message?.from?.id === ctx.me.id) return true;

  const text = msg.text || msg.caption || "";
  const entities = msg.entities || msg.caption_entities || [];
  for (const e of entities) {
    if (e.type === "mention") {
      const mention = text.slice(e.offset, e.offset + e.length).toLowerCase();
      if (mention === `@${username}`) return true;
    }
    if (e.type === "text_mention" && e.user?.id === ctx.me.id) return true;
  }

  // Fallback plain-text @username (some clients)
  if (new RegExp(`@${username}\\b`, "i").test(text)) return true;

  return false;
}

function stripBotMention(text: string, username: string): string {
  return text
    .replace(new RegExp(`@${username}\\b`, "gi"), "")
    .replace(/https?:\/\/\S+/gi, "")
    .trim();
}

function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/gi, "").trim();
}

function isGifOrMediaUrl(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!/^https?:\/\//.test(t)) return false;
  return (
    t.includes("tenor.com") ||
    t.includes("giphy.com") ||
    t.includes(".gif") ||
    t.includes("gif")
  );
}

function shouldIgnoreText(text: string | undefined): boolean {
  if (!text) return true;
  const t = text.trim();
  if (t.startsWith("/")) return true;
  if (t.length < MIN_QUESTION_CHARS) return true;
  if (!/[a-zA-Z0-9]/.test(t)) return true;
  return false;
}

async function enforceCooldown(ctx: Context, userId: number): Promise<boolean> {
  const now = Date.now();
  const last = lastReplyAt.get(userId) ?? 0;
  if (now - last < USER_COOLDOWN_MS) {
    await ctx.reply(`Easy — still catching my breath. Try again in a few seconds.`);
    return false;
  }
  lastReplyAt.set(userId, now);
  return true;
}

async function replyWithGif(ctx: Context, queryHint?: string) {
  if (!GIPHY_API_KEY) {
    await ctx.reply(`Nice GIF. Giphy isn't wired on Telegram yet — too tired.`);
    return;
  }
  const q = pickGifSearchQuery({
    text: queryHint,
    stickerName: ctx.message?.sticker?.emoji || ctx.message?.sticker?.set_name,
  });
  const gifUrl = await searchGifUrl(q);
  if (!gifUrl) {
    await ctx.reply(`Tried to clap back with a GIF. Giphy shrugged. Too tired.`);
    return;
  }
  await ctx.replyWithAnimation(gifUrl);
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    [
      `I'm the <b>Tired FAQ</b> bot — same brain as Discord.`,
      ``,
      `• In <b>Tired FAQ</b>: just ask / send GIFs`,
      `• In the main group: tag me like <code>@TiredFAQ_Bot what's the CA?</code>`,
      ``,
      `Admin helper: <code>/chatid</code>`,
    ].join("\n"),
    { parse_mode: "HTML" },
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    `Ask about Tired Of Web3 / $TIRED.\nIn the main group, @mention me.\nSite: https://hoodrpc.xyz`,
  );
});

bot.command("chatid", async (ctx) => {
  const chatId = ctx.chat.id;
  const threadId = ctx.message?.message_thread_id;
  const lines = [
    `Chat ID: <code>${chatId}</code>`,
    threadId !== undefined
      ? `Topic ID: <code>${threadId}</code>`
      : `Topic ID: (none — not a forum topic)`,
    isFaqChat(chatId) ? `Mode: FAQ (always replies)` : "",
    isMentionChat(chatId) ? `Mode: mention-only` : "",
  ].filter(Boolean);
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
});

bot.on("message:animation", async (ctx) => {
  try {
    if (!shouldHandleMessage(ctx)) return;

    const caption = ctx.message.caption?.trim() || "";
    const username = ctx.me.username || "TiredFAQ_Bot";
    const cleaned = stripBotMention(caption, username);
    if (cleaned.length >= MIN_TEXT_QUESTION_CHARS) {
      const userId = ctx.from?.id;
      if (userId && !(await enforceCooldown(ctx, userId))) return;
      await ctx.replyWithChatAction("typing");
      const asker = ctx.from?.username || ctx.from?.first_name || "anon";
      const reply = await askTiredFaq(
        `Telegram user @${asker} asked:\n${cleaned}`,
      );
      await ctx.reply(reply, { link_preview_options: { is_disabled: true } });
      return;
    }

    const userId = ctx.from?.id;
    if (userId && !(await enforceCooldown(ctx, userId))) return;
    await ctx.replyWithChatAction("upload_video");
    await replyWithGif(ctx, cleaned || ctx.message.animation.file_name);
  } catch (err) {
    console.error("[gif/animation]", err);
  }
});

bot.on("message:sticker", async (ctx) => {
  try {
    if (!shouldHandleMessage(ctx)) return;
    const userId = ctx.from?.id;
    if (userId && !(await enforceCooldown(ctx, userId))) return;
    await ctx.replyWithChatAction("upload_video");
    await replyWithGif(
      ctx,
      `${ctx.message.sticker.emoji || ""} ${ctx.message.sticker.set_name || ""}`.trim(),
    );
  } catch (err) {
    console.error("[gif/sticker]", err);
  }
});

bot.on("message:text", async (ctx) => {
  try {
    if (!shouldHandleMessage(ctx)) return;

    const username = ctx.me.username || "TiredFAQ_Bot";
    const raw = ctx.message.text.trim();
    const text = stripBotMention(raw, username) || stripUrls(raw);

    if (isGifOrMediaUrl(raw) && stripUrls(raw).length < MIN_TEXT_QUESTION_CHARS) {
      const userId = ctx.from?.id;
      if (userId && !(await enforceCooldown(ctx, userId))) return;
      await ctx.replyWithChatAction("upload_video");
      await replyWithGif(ctx, raw);
      return;
    }

    if (shouldIgnoreText(text)) {
      // Mention with no real question
      if (isMentionChat(ctx.chat.id) && isBotAddressed(ctx)) {
        await ctx.reply(
          `Yeah? Ask me something about $TIRED — or hop into https://t.me/TIRED_FAQ`,
        );
      }
      return;
    }

    const userId = ctx.from?.id;
    if (userId && !(await enforceCooldown(ctx, userId))) return;

    await ctx.replyWithChatAction("typing");

    const asker = ctx.from?.username || ctx.from?.first_name || "anon";
    const reply = await askTiredFaq(
      `Telegram user @${asker} asked:\n${text}`,
    );

    await ctx.reply(reply, {
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    console.error("[faq]", err);
    try {
      await ctx.reply(
        "Brain blue-screened. Too tired. Try again — or https://hoodrpc.xyz",
      );
    } catch {
      /* ignore */
    }
  }
});

bot.catch((err) => {
  const e = err.error;
  console.error(`Error while handling update ${err.ctx.update.update_id}:`);
  if (e instanceof GrammyError) {
    console.error("Telegram API error:", e.description);
  } else if (e instanceof HttpError) {
    console.error("HTTP error talking to Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

async function main() {
  console.log(
    `[boot] FAQ chats (always): ${FAQ_CHAT_IDS.length ? FAQ_CHAT_IDS.join(", ") : "(none)"}`,
  );
  console.log(
    `[boot] Mention-only chats: ${MENTION_CHAT_IDS.length ? MENTION_CHAT_IDS.join(", ") : "(none)"}`,
  );
  if (FAQ_TOPIC_IDS.length) {
    console.log(`[boot] FAQ topics: ${FAQ_TOPIC_IDS.join(", ")}`);
  }
  console.log(
    `[boot] Giphy GIF replies: ${GIPHY_API_KEY ? "ON" : "OFF (set GIPHY_API_KEY)"}`,
  );

  await bot.start({
    onStart: (info) => {
      console.log(`[boot] Telegram FAQ bot @${info.username} is running`);
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

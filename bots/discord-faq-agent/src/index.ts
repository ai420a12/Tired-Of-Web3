import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  type Message,
} from "discord.js";
import { askTiredFaq } from "./ai.js";
import {
  FAQ_CHANNEL_IDS,
  GIPHY_API_KEY,
  MIN_QUESTION_CHARS,
  MIN_TEXT_QUESTION_CHARS,
  USER_COOLDOWN_MS,
  requireToken,
} from "./config.js";
import { pickGifSearchQuery, searchGifUrl } from "./giphy.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const lastReplyAt = new Map<string, number>();

function isFaqChannel(channelId: string): boolean {
  if (!FAQ_CHANNEL_IDS.length) return false;
  return FAQ_CHANNEL_IDS.includes(channelId);
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
    t.includes("media.discordapp") ||
    t.includes("cdn.discordapp") ||
    t.includes(".gif") ||
    t.includes("gif")
  );
}

function hasGifLikeMedia(message: Message): boolean {
  if (message.stickers.size > 0) return true;
  if (isGifOrMediaUrl(message.content.trim())) return true;

  for (const att of message.attachments.values()) {
    const name = (att.name || "").toLowerCase();
    const ctype = (att.contentType || "").toLowerCase();
    if (
      ctype.includes("gif") ||
      ctype.includes("webp") ||
      ctype.includes("video") ||
      name.endsWith(".gif") ||
      name.endsWith(".webp") ||
      name.endsWith(".mp4")
    ) {
      return true;
    }
  }

  for (const emb of message.embeds) {
    const provider = (emb.provider?.name || "").toLowerCase();
    const url = `${emb.url || ""} ${emb.thumbnail?.url || ""} ${emb.image?.url || ""} ${emb.video?.url || ""}`.toLowerCase();
    if (
      provider.includes("tenor") ||
      provider.includes("giphy") ||
      url.includes("tenor.com") ||
      url.includes("giphy.com") ||
      url.includes(".gif")
    ) {
      return true;
    }
  }

  return false;
}

function mediaSearchHints(message: Message): {
  stickerName?: string;
  embedName?: string;
} {
  const sticker = message.stickers.first();
  const emb = message.embeds[0];
  return {
    stickerName: sticker?.name,
    embedName: emb?.provider?.name
      ? `${emb.provider.name} ${emb.description || emb.title || ""}`
      : emb?.title || emb?.description || undefined,
  };
}

function shouldIgnoreTextOnly(content: string): boolean {
  const t = content.trim();
  if (t.length < MIN_QUESTION_CHARS) return true;
  if (!/[a-zA-Z0-9]/.test(t)) return true;
  return false;
}

async function enforceCooldown(
  message: Message,
  userId: string,
): Promise<boolean> {
  const now = Date.now();
  const last = lastReplyAt.get(userId) ?? 0;
  if (now - last < USER_COOLDOWN_MS) {
    await message.reply({
      content: `Easy — I'm still catching my breath. Try again in a few seconds.`,
      allowedMentions: { repliedUser: false },
    });
    return false;
  }
  lastReplyAt.set(userId, now);
  return true;
}

client.once(Events.ClientReady, (ready) => {
  console.log(`[boot] Tired FAQ agent @${ready.user.tag} is running`);
  console.log(
    `[boot] FAQ channels: ${FAQ_CHANNEL_IDS.length ? FAQ_CHANNEL_IDS.join(", ") : "(none set — set FAQ_CHANNEL_IDS)"}`,
  );
  console.log(
    `[boot] Giphy GIF replies: ${GIPHY_API_KEY ? "ON" : "OFF (set GIPHY_API_KEY)"}`,
  );
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.channel.type !== ChannelType.GuildText) return;
    if (!isFaqChannel(message.channel.id)) return;

    const text = message.content.trim();
    const textWithoutUrls = stripUrls(text);
    const media = hasGifLikeMedia(message);
    // Don't treat a bare GIF/Tenor/Giphy link as an FAQ question
    const isRealQuestion = textWithoutUrls.length >= MIN_TEXT_QUESTION_CHARS;

    // GIF / sticker vibe reply (no real question text)
    if (media && !isRealQuestion) {
      if (!GIPHY_API_KEY) {
        await message.reply({
          content: `Nice GIF. I'm too tired to clap back until Giphy is wired up.`,
          allowedMentions: { repliedUser: false },
        });
        return;
      }
      if (!(await enforceCooldown(message, message.author.id))) return;

      const hints = mediaSearchHints(message);
      const q = pickGifSearchQuery({ text, ...hints });
      const gifUrl = await searchGifUrl(q);
      if (!gifUrl) {
        await message.reply({
          content: `Tried to find a clap-back GIF. Tenor died, Giphy shrugged. Too tired.`,
          allowedMentions: { repliedUser: false },
        });
        return;
      }

      await message.reply({
        content: gifUrl,
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    // Text FAQ
    if (shouldIgnoreTextOnly(text)) return;
    if (!(await enforceCooldown(message, message.author.id))) return;

    await message.channel.sendTyping();

    const reply = await askTiredFaq(
      `Discord user @${message.author.username} asked:\n${text}`,
    );

    await message.reply({
      content: reply,
      allowedMentions: { repliedUser: false },
      flags: MessageFlags.SuppressEmbeds,
    });
  } catch (err) {
    console.error("[faq]", err);
    try {
      await message.reply({
        content:
          "Brain blue-screened. Too tired. Try again in a bit — or check https://hoodrpc.xyz",
        allowedMentions: { repliedUser: false },
      });
    } catch {
      /* channel send failed */
    }
  }
});

async function main() {
  if (!FAQ_CHANNEL_IDS.length) {
    console.warn(
      "[boot] WARNING: FAQ_CHANNEL_IDS is empty — bot will stay silent until you set it.",
    );
  }
  await client.login(requireToken());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

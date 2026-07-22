"use client";

import { LINKS } from "@/lib/constants";
import { playClick } from "@/lib/sounds";
import {
  IconDiscord,
  IconOpenSea,
  IconTelegram,
  IconX,
} from "@/components/ui/SocialIcons";

const socials = [
  {
    id: "x",
    label: "X",
    href: LINKS.x,
    title: "Follow on X",
    Icon: IconX,
    iconClass: "text-foreground",
  },
  {
    id: "discord",
    label: "Discord",
    href: LINKS.discord,
    title: "Discord — coming soon",
    Icon: IconDiscord,
    iconClass: "text-[#5865F2]",
  },
  {
    id: "tg",
    label: "Telegram",
    href: LINKS.telegram,
    title: "Telegram — coming soon",
    Icon: IconTelegram,
    iconClass: "text-[#2AABEE]",
  },
  {
    id: "opensea",
    label: "OpenSea",
    href: LINKS.opensea,
    title: "OpenSea — coming soon",
    Icon: IconOpenSea,
    iconClass: "text-[#2081E2]",
  },
] as const;

interface SocialLinksProps {
  className?: string;
}

const shellClass =
  "neon-border inline-flex h-8 w-8 items-center justify-center rounded-md bg-deep-purple/30 transition-all sm:h-9 sm:w-9";

export default function SocialLinks({ className = "" }: SocialLinksProps) {
  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 ${className}`}>
      {socials.map((social) => {
        const live = Boolean(social.href);
        const Icon = social.Icon;

        if (live && social.href) {
          return (
            <a
              key={social.id}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              title={social.title}
              aria-label={social.label}
              onClick={() => playClick()}
              className={`${shellClass} hover:bg-deep-purple/50`}
            >
              <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${social.iconClass}`} />
            </a>
          );
        }

        return (
          <button
            key={social.id}
            type="button"
            title={social.title}
            aria-label={`${social.label} (coming soon)`}
            disabled
            className={`${shellClass} cursor-not-allowed opacity-70`}
          >
            <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${social.iconClass}`} />
          </button>
        );
      })}
    </div>
  );
}

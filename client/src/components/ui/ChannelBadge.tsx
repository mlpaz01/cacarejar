import { cn } from "@/lib/utils";

type Channel = "linkedin" | "tiktok" | "instagram" | "google";

const channelConfig: Record<Channel, { label: string; className: string; icon: string }> = {
  linkedin: {
    label: "LinkedIn",
    className: "bg-blue-600/15 text-blue-400 border-blue-600/30",
    icon: "in",
  },
  tiktok: {
    label: "TikTok",
    className: "bg-pink-500/15 text-pink-400 border-pink-500/30",
    icon: "tt",
  },
  instagram: {
    label: "Instagram",
    className: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    icon: "ig",
  },
  google: {
    label: "Google",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    icon: "G",
  },
};

interface ChannelBadgeProps {
  channel: string;
  className?: string;
  showLabel?: boolean;
}

export function ChannelBadge({ channel, className, showLabel = true }: ChannelBadgeProps) {
  const config = channelConfig[channel as Channel] ?? {
    label: channel,
    className: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    icon: "?",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
        config.className,
        className
      )}
    >
      <span className="font-bold text-[10px] uppercase tracking-wider">{config.icon}</span>
      {showLabel && config.label}
    </span>
  );
}

export function ChannelDot({ channel, size = "sm" }: { channel: string; size?: "sm" | "md" }) {
  const config = channelConfig[channel as Channel];
  if (!config) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold text-[9px] uppercase tracking-wider border",
        config.className,
        size === "sm" ? "w-5 h-5" : "w-7 h-7 text-xs"
      )}
    >
      {config.icon}
    </span>
  );
}

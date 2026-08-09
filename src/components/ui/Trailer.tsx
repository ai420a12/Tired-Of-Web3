"use client";

type TrailerProps = {
  title: string;
  src: string;
  accent?: "purple" | "green";
};

export default function Trailer({
  title,
  src,
  accent = "green",
}: TrailerProps) {
  const isPurple = accent === "purple";

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <h2
        className={`text-center font-mono text-base font-bold tracking-wide sm:text-lg ${
          isPurple
            ? "text-neon-purple neon-purple-glow"
            : "text-neon-green neon-green-glow"
        }`}
      >
        {title}
      </h2>
      <div
        className={`w-full overflow-hidden rounded-xl bg-black/60 ${
          isPurple
            ? "neon-border shadow-[0_0_30px_rgba(157,78,221,0.2)]"
            : "neon-border-green shadow-[0_0_30px_rgba(32,129,226,0.15)]"
        }`}
      >
        <video
          className="aspect-video w-full bg-black object-cover"
          src={src}
          controls
          playsInline
          preload="auto"
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}

"use client";

export default function Trailer() {
  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-xl neon-border-green bg-black/60 shadow-[0_0_30px_rgba(0,255,65,0.15)]">
      <video
        className="aspect-video w-full bg-black object-cover"
        src="/videos/tired-trailer.mp4"
        controls
        playsInline
        preload="metadata"
        poster="/images/banner.jpg"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

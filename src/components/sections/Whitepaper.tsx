"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import GlitchText from "@/components/effects/GlitchText";
import GoalBar from "@/components/ui/GoalBar";
import {
  FACTORY_GOAL_USD,
  FACTORY_MACHINES,
  FACTORY_WALLET,
  LINKS,
  MERCH_CATALOG,
} from "@/lib/constants";

const goalLabel = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
}).format(FACTORY_GOAL_USD);

export default function Whitepaper() {
  return (
    <section id="whitepaper" className="relative px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 pt-8 text-center sm:pt-12">
          <GlitchText
            as="h2"
            className="font-mono text-4xl font-bold text-neon-green neon-green-glow sm:text-5xl"
          >
            WHITEPAPER
          </GlitchText>
        </div>

        <div className="space-y-10">
          {/* Mission */}
          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="neon-border rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm sm:p-10"
          >
            <h3 className="font-mono text-xl font-bold text-neon-pink sm:text-2xl">
              What Tired is actually about
            </h3>
            <div className="mt-5 space-y-4 font-mono text-sm leading-relaxed text-foreground/75 sm:text-base">
              <p>
                <a
                  href={LINKS.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-neon-pink transition-colors hover:text-neon-green"
                >
                  TiredOfWeb3
                </a>{" "}
                exists to help people stay safer in Web3, offer{" "}
                <span className="font-bold text-neon-pink">FREE</span> 1:1
                support when the space has wrecked their mental health, and build
                something real under the exhaustion — a factory for merch, signs,
                and physical collectibles.
              </p>
              <p>
                That factory was the dream long before I was hired as CMO of The
                Penimals.{" "}
                <span className="font-bold text-neon-green">$TIRED</span> is how
                we fund it — a project that protects the culture while shipping
                physical product people can actually hold.
              </p>
              <p>
                Holders can pay in{" "}
                <span className="text-neon-pink">FIAT</span>,{" "}
                <span className="text-neon-pink">ETH</span>, or{" "}
                <span className="text-neon-pink">$TIRED</span> to order{" "}
                <span className="text-neon-green">Tiredboxes</span> — or{" "}
                <span className="text-neon-green">Peniboxes</span> — the
                packaging that delivers merch and physical collectibles of your
                favorite NFTs.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-stretch justify-center gap-4 sm:gap-6">
              <figure className="w-full max-w-[280px] overflow-hidden rounded-xl border border-neon-purple/30 bg-background/40 sm:max-w-[360px]">
                <div className="relative aspect-[5/4] bg-[#0a0a12]">
                  <Image
                    src="/images/boxes/tiredboxes.png"
                    alt="Tiredboxes — TiredOfWeb3 packing boxes"
                    fill
                    className="object-contain p-2"
                    sizes="360px"
                  />
                </div>
                <figcaption className="px-3 py-2 text-center font-mono text-xs font-bold text-neon-green sm:text-sm">
                  Tiredboxes
                </figcaption>
              </figure>
              <figure className="w-full max-w-[280px] overflow-hidden rounded-xl border border-neon-purple/30 bg-background/40 sm:max-w-[360px]">
                <div className="relative aspect-[5/4] bg-[#0a0a12]">
                  <Image
                    src="/images/boxes/peniboxes.png"
                    alt="Peniboxes — The Penimals packing boxes"
                    fill
                    className="object-contain p-2"
                    sizes="360px"
                  />
                </div>
                <figcaption className="px-3 py-2 text-center font-mono text-xs font-bold text-neon-green sm:text-sm">
                  Peniboxes
                </figcaption>
              </figure>
            </div>
          </motion.article>

          {/* Merch / Collectibles */}
          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="neon-border rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm sm:p-10"
          >
            <h3 className="font-mono text-xl font-bold text-neon-pink sm:text-2xl">
              Merch &amp; collectibles you can order
            </h3>
            <div className="mt-5 space-y-4 font-mono text-sm leading-relaxed text-foreground/75 sm:text-base">
              <p>
                Once the factory is online, this is the kind of product we ship —
                premium streetwear, gallery-grade prints, and museum-style
                physicals of the NFTs you already own.
              </p>
              <p>
                If you own the NFT, you own the IP rights for that piece — and
                you can order anything you want from us based on it. Hoodies,
                tees, tracksuits, hats, signs, and{" "}
                <span className="text-neon-green">1:1 physical collectibles</span>{" "}
                of your exact token — not another generic logo drop that falls
                apart after two washes.
              </p>
              <p className="font-bold text-neon-pink">
                If it can be worn, hung, or displayed, we want it coming off our
                floor.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {MERCH_CATALOG.map((item, i) => (
                <motion.figure
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.03 }}
                  className="overflow-hidden rounded-xl border border-neon-purple/25 bg-background/40"
                >
                  <div className="relative aspect-square">
                    <Image
                      src={item.image}
                      alt={item.label}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  </div>
                  <figcaption className="space-y-0.5 px-2.5 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-neon-purple">
                      {item.category}
                    </p>
                    <p className="font-mono text-xs font-bold text-foreground/80 sm:text-sm">
                      {item.label}
                    </p>
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          </motion.article>

          {/* Funding */}
          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="neon-border-green rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm sm:p-10"
          >
            <h3 className="font-mono text-xl font-bold text-neon-green sm:text-2xl">
              The factory raise — {goalLabel}
            </h3>
            <div className="mt-5 space-y-4 font-mono text-sm leading-relaxed text-foreground/75 sm:text-base">
              <p>
                We need{" "}
                <span className="font-bold text-neon-green">{goalLabel}</span>{" "}
                to open the factory: warehouse rent, machines, filtration, and
                the floor that turns NFT IP into real objects.
              </p>
              <p>
                <span className="text-neon-pink">100% of trading fees</span>
                {" "}
                go into a dedicated wallet. That wallet&apos;s growing LP is what
                powers the goal bar — as fees accumulate, the bar fills toward{" "}
                {goalLabel}.
              </p>
              <div className="pt-2">
                <GoalBar />
              </div>
              <p className="rounded-lg border border-neon-purple/30 bg-background/40 px-4 py-3 text-xs text-foreground/60 sm:text-sm">
                Fee wallet:{" "}
                <span className="break-all text-neon-purple">
                  {FACTORY_WALLET}
                </span>
              </p>
              <p className="text-center font-mono text-xs leading-relaxed text-neon-pink sm:text-sm">
                Anyone who would like to donate ETH to the cause and help us
                reach our goal faster can also use this wallet for donations.
              </p>
            </div>
          </motion.article>

          {/* Warehouse */}
          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="neon-border rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm sm:p-10"
          >
            <h3 className="font-mono text-xl font-bold text-neon-purple sm:text-2xl">
              Warehouse first
            </h3>
            <div className="mt-5 space-y-4 font-mono text-sm leading-relaxed text-foreground/75 sm:text-base">
              <p>
                Before any machine powers on, we rent a warehouse large enough
                for embroidery lines, CNC bays, UV print beds, presses, ovens,
                filtration, and safe waste handling. That space is the skeleton
                of the factory.
              </p>
            </div>
            <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-xl border border-neon-purple/30">
              <Image
                src="/images/factory/factory-warehouse.png"
                alt="Warehouse floor for the Tired factory"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 960px"
              />
            </div>
          </motion.article>

          {/* Machines */}
          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="neon-border rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm sm:p-10"
          >
            <h3 className="font-mono text-xl font-bold text-neon-pink sm:text-2xl">
              The machines
            </h3>
            <p className="mt-4 font-mono text-sm leading-relaxed text-foreground/75 sm:text-base">
              This is the equipment we need on the floor to stop shipping
              disposable merch and start shipping top-grade collectibles and
              apparel.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FACTORY_MACHINES.map((machine, i) => (
                <motion.div
                  key={machine.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="overflow-hidden rounded-xl border border-neon-purple/25 bg-background/40"
                >
                  <div className="relative aspect-[4/3] bg-background/60">
                    <Image
                      src={machine.image}
                      alt={machine.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-4">
                    <h4 className="font-mono text-sm font-bold text-neon-green">
                      {machine.name}
                    </h4>
                    <p className="mt-2 font-mono text-xs leading-relaxed text-foreground/60">
                      {machine.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.article>

          {/* NFT IP */}
          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="neon-border rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm sm:p-10"
          >
            <h3 className="font-mono text-xl font-bold text-neon-green sm:text-2xl">
              Own the NFT. Own the IP. Order the real thing.
            </h3>
            <div className="mt-5 space-y-4 font-mono text-sm leading-relaxed text-foreground/75 sm:text-base">
              <p>
                Once the factory is secured, we can produce collectibles for
                every NFT project in Web3. If you own the NFT, you own the IP
                rights for that piece — and you can order anything you want from
                us based on it.
              </p>
              <p>
                We&apos;re tired of collections spamming the timeline with
                generic logo merch. We&apos;re tired of cheap Chinese toy drops
                posing as &ldquo;collectibles.&rdquo; Secure this factory and
                those machines, and the space gets top-grade pieces at any size —
                merch that doesn&apos;t fall apart after two washes.
              </p>
              <p>
                We&apos;re also ready to work directly with project CEOs and
                founders to mass-produce their merchandise. Expect pricing that
                undercuts{" "}
                <span className="text-neon-pink">Alibaba</span> and{" "}
                <span className="text-neon-pink">AliExpress</span> — with
                quality that leaves them behind.
              </p>
            </div>
          </motion.article>

          {/* Community support */}
          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="neon-border-green rounded-2xl bg-deep-purple/30 p-6 backdrop-blur-sm sm:p-10"
          >
            <h3 className="font-mono text-xl font-bold text-neon-pink sm:text-2xl">
              Give back to the builders
            </h3>
            <div className="mt-5 space-y-4 font-mono text-sm leading-relaxed text-foreground/75 sm:text-base">
              <p>
                Most importantly: we&apos;ll donate signs and merch to the people
                actually pushing Web3 culture toward mass adoption —{" "}
                <a
                  href={LINKS.nfc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-neon-pink transition-colors hover:text-neon-green"
                >
                  NFC
                </a>{" "}
                and its CEO,{" "}
                <a
                  href={LINKS.johnKarp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-neon-pink transition-colors hover:text-neon-green"
                >
                  John Karp
                </a>
                . John has helped me more than I can put into a whitepaper — being
                able to do this for him and for the space is the least we can do.
              </p>
              <p>
                We&apos;re just as happy to do the same for any other NFT event
                that wants the help. Once the machines are running, there&apos;s
                no limit to how much we can support them with advertising
                products — signs, merch, and whatever else puts real culture in
                front of people.
              </p>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}

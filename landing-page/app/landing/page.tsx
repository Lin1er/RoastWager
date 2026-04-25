"use client";

import {
  ArrowRight,
  CircleDollarSign,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Trophy,
} from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Pagination, Autoplay } from "swiper/modules";

import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";

import RotatingText from "../components/RotatingTitle";
import LiquidEther from "../components/LiquidEther";
import Image from "next/image";
import Link from "next/link";

const features = [
  {
    title: "Blind Vote Market",
    desc: "Support Bull or Bear without seeing the full pool. Real sentiment, no herd effect.",
    icon: ThumbsUp,
  },
  {
    title: "Post a Roast",
    desc: "Turn a hot take into a live market in seconds and let the crowd decide.",
    icon: CircleDollarSign,
  },
  {
    title: "Level & Reputation",
    desc: "Build XP from participation and unlock higher stake caps as your track record grows.",
    icon: Trophy,
  },
  {
    title: "USDC Based",
    desc: "Clear stable-value staking flow with transparent payout mechanics on-chain.",
    icon: ShieldCheck,
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[var(--bg-main)] text-[var(--text-main)]">
      <div className="pointer-events-none fixed inset-0 opacity-90">
        <LiquidEther
          colors={["#5227FF", "#FF9FFC", "#B497CF"]}
          mouseForce={22}
          cursorSize={96}
          isViscous
          viscous={30}
          iterationsViscous={32}
          iterationsPoisson={32}
          resolution={0.5}
          isBounce={false}
          autoDemo
          autoSpeed={0.45}
          autoIntensity={2.1}
          takeoverDuration={0.25}
          autoResumeDelay={2800}
          autoRampDuration={0.6}
        />
      </div>

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(82,39,255,0.24),transparent_44%),radial-gradient(circle_at_80%_14%,rgba(255,159,252,0.16),transparent_40%),linear-gradient(180deg,rgba(24,24,27,0.12),rgba(24,24,27,0.82))]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-12 pt-6 md:px-10 lg:px-16 lg:pt-8">
        <header
          className="
mb-4 md:mb-6
flex items-center justify-between
rounded-2xl
border border-[var(--border-soft)]
bg-[var(--bg-card)]/70
px-4 py-3
backdrop-blur-md
"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-wide text-[var(--text-main)] md:text-base">
              ROASTWAGER
            </span>
          </div>

          <div className="hidden items-center gap-2 text-xs md:flex">
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--bg-main)]/80 px-3 py-1 text-[var(--text-muted)]">
              Monad Testnet
            </span>
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--bg-main)]/80 px-3 py-1 text-[var(--text-muted)]">
              USDC Market
            </span>
          </div>
        </header>

        <div
          className="
-mt-16
-mb-10
flex justify-center
"
        >
          <div
            className="
    relative

    w-[300px]
    h-[300px]

    sm:w-[380px]
    sm:h-[380px]

    md:w-[460px]
    md:h-[460px]
    "
          >
            <Image
              src="/aurel.png"
              alt="RoastWager Logo"
              fill
              priority
              className="
        object-contain
        scale-[1.35]
      "
            />
          </div>
        </div>

        <section className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--bg-card)]/75 px-3 py-1 text-xs text-[var(--text-muted)] backdrop-blur-md">
            <Sparkles size={14} className="text-[var(--primary-soft)]" />
            Roast takes. Stake conviction. Earn reputation.
          </div>

          <h1 className="mb-5 text-4xl font-black leading-[1.05] sm:text-5xl md:text-6xl lg:text-7xl">
            <RotatingText />
          </h1>

          <p className="max-w-3xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base md:text-lg">
            RoastWager turns your hottest opinions into stake-backed prediction
            markets. Climb the leaderboard with every meaningful call.
          </p>

          <div className="mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <Link href="https://roast-wager.vercel.app" className="group flex-1 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--primary-soft)] sm:text-base">
              Launch App
              <ArrowRight
                size={16}
                className="ml-2 inline-block transition group-hover:translate-x-1"
              />
            </Link>
          </div>
        </section>

        <section className="mt-10 w-full">
          <div className="mb-20 mx-auto w-full max-w-5xl overflow-visible px-2 md:px-8">
            <Swiper
              effect="coverflow"
              centeredSlides
              slidesPerView={1.12}
              loop={false}
              rewind
              breakpoints={{
                640: { slidesPerView: 1.32 },
                960: { slidesPerView: 1.58 },
                1280: { slidesPerView: 1.82 },
              }}
              speed={900}
              autoplay={{
                delay: 2600,
                disableOnInteraction: false,
                pauseOnMouseEnter: false,
                waitForTransition: false,
              }}
              pagination={{ clickable: true }}
              coverflowEffect={{
                rotate: 0,
                stretch: 0,
                depth: 210,
                modifier: 1.35,
                scale: 0.84,
                slideShadows: false,
              }}
              modules={[EffectCoverflow, Pagination, Autoplay]}
              className="feature-swiper pb-12"
            >
              {features.map((item) => {
                const Icon = item.icon;

                return (
                  <SwiperSlide key={item.title} className="py-1">
                    <article className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)]/82 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-md md:p-10">
                      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/20">
                        <Icon
                          size={32}
                          className="text-[var(--primary-soft)]"
                        />
                      </div>

                      <h3 className="mb-3 text-2xl font-black leading-tight">
                        {item.title}
                      </h3>
                      <p className="mx-auto max-w-sm text-sm leading-relaxed text-[var(--text-muted)] md:text-base">
                        {item.desc}
                      </p>
                    </article>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </div>
        </section>

        <section className="mb-10 grid gap-3 sm:grid-cols-3">
        <div className="
col-span-full

w-full
max-w-[330px]
md:max-w-[420px]

mx-auto

flex items-center justify-center

rounded-2xl
bg-[var(--primary)]

px-5 py-3

text-sm sm:text-base
font-bold
text-white

transition
hover:bg-[var(--primary-soft)]
">
  Market Foundation
</div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]/70 p-4 backdrop-blur-md">
            <p className="text-xs text-[var(--text-muted)]">Settlement Model</p>
            <p className="mt-1 text-lg font-black">
              Blind Pool + On-chain Resolve
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]/70 p-4 backdrop-blur-md">
            <p className="text-xs text-[var(--text-muted)]">Token</p>
            <p className="mt-1 text-lg font-black">USDC Native Flow</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]/70 p-4 backdrop-blur-md">
            <p className="text-xs text-[var(--text-muted)]">Experience</p>
            <p className="mt-1 text-lg font-black">Level-based Stake Limits</p>
          </div>
        </section>
      </div>
    </div>
  );
}

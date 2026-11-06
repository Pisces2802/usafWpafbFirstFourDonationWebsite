"use client";

import { Pause, Play } from "lucide-react";
import Image from "next/image";

import heroPoster from "@/assets/hero-poster.jpg";
import { useHeroVideo } from "@/hooks/use-hero-video";
import { cn } from "@/lib/utils";

type HeroVideoProps = {
  baseUrl?: string;
  pauseLabel: string;
  playLabel: string;
};

export const HeroVideo = ({ baseUrl, pauseLabel, playLabel }: HeroVideoProps) => {
  const {
    ref,
    toggle,
    shouldUsePoster,
    sources,
    sourceKey,
    hasStarted,
    showPauseIcon,
    videoProps,
    onLastSourceError,
  } = useHeroVideo(baseUrl);

  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 -z-20">
        <Image
          src={heroPoster}
          alt=""
          fill
          sizes="100vw"
          placeholder="blur"
          loading="eager"
          fetchPriority="high"
          className="object-cover object-[70%_center]"
        />
        {!shouldUsePoster && (
          <video
            key={sourceKey}
            ref={ref}
            muted
            loop
            playsInline
            preload="none"
            disablePictureInPicture
            className={cn(
              "absolute inset-0 size-full object-cover object-[70%_center] opacity-0 transition-opacity duration-700 ease-out",
              hasStarted && "opacity-100",
            )}
            {...videoProps}
          >
            {sources.map((source, index) => (
              <source
                key={source.src}
                src={source.src}
                type={source.type}
                onError={index === sources.length - 1 ? onLastSourceError : undefined}
              />
            ))}
          </video>
        )}
      </div>

      {!shouldUsePoster && (
        <button
          type="button"
          onClick={toggle}
          aria-label={showPauseIcon ? pauseLabel : playLabel}
          className="animate-in fade-in-0 bg-night/55 hover:bg-night/80 absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full border border-white/25 text-white backdrop-blur-sm transition-[background-color,scale] duration-150 active:scale-95 md:top-auto md:right-8 md:bottom-8"
        >
          <Pause
            aria-hidden="true"
            className={cn(
              "col-start-1 row-start-1 size-5 transition-[opacity,scale] duration-200",
              showPauseIcon ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
          />
          <Play
            aria-hidden="true"
            className={cn(
              "col-start-1 row-start-1 size-5 translate-x-px transition-[opacity,scale] duration-200",
              showPauseIcon ? "scale-75 opacity-0" : "scale-100 opacity-100",
            )}
          />
        </button>
      )}
    </>
  );
};

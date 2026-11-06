import { cn } from "@/lib/utils";

type StoryPortraitProps = {
  name: string;
  className?: string;
};

/**
 * Stand-in for a portrait until real photos (with consent) arrive: the person's initial on a
 * runway-marking ground. Decorative only; the name is always given in text nearby.
 */
export const StoryPortrait = ({ name, className }: StoryPortraitProps) => (
  <div
    aria-hidden="true"
    className={cn(
      "bg-night relative isolate flex aspect-[4/3] items-end overflow-hidden rounded-xl p-6",
      className,
    )}
  >
    <div className="absolute inset-0 -z-10 bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.04)_0_14px,transparent_14px_28px)]" />
    <div className="bg-ultramarine absolute inset-y-0 right-0 -z-10 w-1/3 opacity-70" />
    <span className="headline text-[7rem] leading-none text-white/90 lg:text-[9rem]">
      {name.charAt(0)}
    </span>
  </div>
);

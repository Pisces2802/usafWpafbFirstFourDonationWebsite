import type { StaticImageData } from "next/image";

export type ImpactStat = {
  id: "veteransHelped" | "familiesSupported" | "volunteerHours";
  value: number;
};

export type Partner = {
  name: string;
  logo: StaticImageData;
  href?: string;
};

/** Real, sourced figures only (max 3). The stats row stays hidden while this is empty. */
export const impactStats: ImpactStat[] = [];

/** Partners who have agreed to be listed. The logo strip stays hidden while this is empty. */
export const partners: Partner[] = [];

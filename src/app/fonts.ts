import { Archivo, Inter } from "next/font/google";

export const archivo = Archivo({
  // Only `latin` is preloaded; it covers Spanish and French. Other subsets load on demand.
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const inter = Inter({
  // Only `latin` is preloaded; it covers Spanish and French. Other subsets load on demand.
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** Font variables for a root layout's `<html>` class. */
export const fontVariables = `${archivo.variable} ${inter.variable}`;

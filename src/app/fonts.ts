import { Archivo, Public_Sans } from "next/font/google";

export const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const publicSans = Public_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-public-sans",
  display: "swap",
});

/** Font variables for a root layout's `<html>` class. */
export const fontVariables = `${archivo.variable} ${publicSans.variable}`;

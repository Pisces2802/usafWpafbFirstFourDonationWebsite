import { LucideIcon } from "lucide-react";

export type MaybePromise<T> = T | Promise<T>;

export type Maybe<T> = T | null | undefined;

export type Option = {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
  icon?: LucideIcon;
};

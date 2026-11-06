import { cn } from "cn";

type Variant = "default" | "error" | "info" | "success" | "warning";

const VARIANT_STYLES: Record<Variant, string> = {
  default: "bg-gray-100 text-gray-800 border-gray-300",
  error: "bg-red-100 text-red-800 border-red-300",
  info: "bg-blue-100 text-blue-800 border-blue-300",
  success: "bg-green-100 text-green-800 border-green-300",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-300",
};

interface Props {
  label: string;
  value: string;
  onClick: (value: string) => void;
  selected: boolean;
  className?: string;
  description?: string;
  disabled?: boolean;
  variant?: Variant;
}

export function Statistic({ variant = "default" }: Props) {
  <div className={cn("rounded-md border p-4", VARIANT_STYLES[variant])}>
    <div></div>
  </div>;
}

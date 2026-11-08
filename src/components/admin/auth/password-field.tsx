"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, useState } from "react";

import { TextField } from "@/components/donation/text-field";
import { Button } from "@/components/ui/button";

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, "type" | "endSlot">;

/** A password input with a button that shows what's been typed. */
export const PasswordField = (props: PasswordFieldProps) => {
  const t = useTranslations("Admin.auth");
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <TextField
      {...props}
      type={isVisible ? "text" : "password"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      endSlot={
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={isVisible ? t("hidePassword") : t("showPassword")}
          aria-controls={props.id}
          onClick={() => setIsVisible((visible) => !visible)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Icon aria-hidden="true" />
        </Button>
      }
    />
  );
};

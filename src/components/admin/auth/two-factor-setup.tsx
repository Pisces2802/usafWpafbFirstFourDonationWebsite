"use client";

import { Check, Copy, Mail, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { AuthAlert, AuthHeading, AuthNotice, AuthSubmit } from "@/components/admin/auth/auth-parts";
import { PasswordField } from "@/components/admin/auth/password-field";
import { RecoveryCodes } from "@/components/admin/auth/recovery-codes";
import { TextField } from "@/components/donation/text-field";
import { Button } from "@/components/ui/button";
import { useAuthForm } from "@/hooks/use-auth-form";
import { useCopy } from "@/hooks/use-copy";
import { useAuthenticatorSetup } from "@/hooks/use-two-factor-setup";
import { type AuthError, confirmPasswordSchema, totpCodeSchema } from "@/lib/admin/auth/schema";
import {
  beginEmailSetup,
  confirmAuthenticatorSetup,
  confirmEmailSetup,
  skipTwoFactorSetup,
} from "@/lib/admin/auth/two-factor-actions";

export type TwoFactorMethod = "authenticator" | "email";

type Step =
  | { kind: "choose" }
  | { kind: "password"; method: TwoFactorMethod; error?: AuthError }
  | { kind: "method"; method: TwoFactorMethod; password?: string }
  | { kind: "codes"; codes: string[]; next: string };

type TwoFactorSetupProps = {
  email: string;
  next?: string;
  /** Their role holds an `identity:` or `auth:` permission, so there's no skipping it. */
  required: boolean;
  /**
   * `invite`: the first sign-in, between password and code. `signedIn`: already signed in, from
   * Settings or because their role now needs it; their current password is asked for first.
   */
  context: "invite" | "signedIn";
  /** Which methods to offer. Settings leaves out the one they already use for email. */
  methods: TwoFactorMethod[];
  /** Start on this method instead of the chooser, as Settings does. */
  method?: TwoFactorMethod;
  /** Shows the heading; Settings has its own in the dialog. */
  showHeading?: boolean;
  /** Runs after they've saved their recovery codes, instead of going to `next`. */
  onFinished?: () => void;
};

const codeInputClass = "[&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.3em]";

const StartOver = () => {
  const t = useTranslations("Admin.auth.twoFactor");
  return (
    <Link
      href="/admin/sign-in"
      className="text-primary text-sm font-medium underline-offset-4 hover:underline"
    >
      {t("startOver")}
    </Link>
  );
};

/** Picks an app, an emailed code or, where the role allows it, neither for now. */
const ChooseMethod = ({
  email,
  methods,
  canSkip,
  next,
  onChoose,
}: {
  email: string;
  methods: TwoFactorMethod[];
  canSkip: boolean;
  next?: string;
  onChoose: (method: TwoFactorMethod) => void;
}) => {
  const t = useTranslations("Admin.auth");
  const router = useRouter();
  const [isSkipping, startSkip] = useTransition();
  const [error, setError] = useState<AuthError | "unknown" | null>(null);
  const options = [
    {
      method: "authenticator" as const,
      icon: Smartphone,
      label: t("setup.choose.authenticator"),
      hint: t("setup.choose.authenticatorHint"),
    },
    {
      method: "email" as const,
      icon: Mail,
      label: t("setup.choose.email"),
      hint: t("setup.choose.emailHint", { email }),
    },
  ].filter((option) => methods.includes(option.method));

  const skip = () =>
    startSkip(async () => {
      setError(null);
      try {
        const result = await skipTwoFactorSetup(next);
        if (result.ok) router.replace(result.next ?? "/admin");
        else setError(result.error);
      } catch {
        setError("unknown");
      }
    });

  return (
    <div className="flex flex-col gap-3">
      <AuthAlert>{error && t(`errors.${error}`)}</AuthAlert>
      {error === "expired" && <StartOver />}
      {options.map(({ method, icon: Icon, label, hint }) => (
        <button
          key={method}
          type="button"
          onClick={() => onChoose(method)}
          className="hover:bg-muted focus-visible:ring-ring flex min-h-11 items-start gap-3 rounded-xl border p-4 text-left outline-none focus-visible:ring-2"
        >
          <Icon aria-hidden="true" className="text-primary mt-0.5 size-5 shrink-0" />
          <span className="flex flex-col gap-1">
            <span className="font-medium">{label}</span>
            <span className="text-muted-foreground text-sm">{hint}</span>
          </span>
        </button>
      ))}
      {canSkip && (
        <div className="mt-2 flex flex-col items-start gap-1">
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-11 px-0"
            disabled={isSkipping}
            onClick={skip}
          >
            {t("setup.choose.skip")}
          </Button>
          <span className="text-muted-foreground text-sm">{t("setup.choose.skipHint")}</span>
        </div>
      )}
    </div>
  );
};

/** Their current password, before anything about how they sign in changes. */
const PasswordStep = ({
  error,
  onContinue,
}: {
  error?: AuthError;
  onContinue: (password: string) => void;
}) => {
  const t = useTranslations("Admin.auth");
  const { register, submit, fieldError } = useAuthForm({
    schema: confirmPasswordSchema,
    defaultValues: { password: "" },
    // Checked by the server when the next step starts, so nothing is sent from here.
    action: async () => ({ ok: true }),
    onSuccess: (_result, values) => onContinue(values.password),
  });
  const passwordError = fieldError("password");

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <p className="text-sm">{t("setup.passwordStep")}</p>
      <AuthAlert>{error && t(`errors.${error}`)}</AuthAlert>
      <PasswordField
        id="setup-password"
        label={t("currentPassword")}
        autoComplete="current-password"
        autoFocus
        error={passwordError && t(`errors.${passwordError}` as Parameters<typeof t>[0])}
        {...register("password")}
      />
      <Button type="submit" size="touch" className="w-full">
        {t("setup.passwordContinue")}
      </Button>
    </form>
  );
};

type MethodStepProps = {
  password?: string;
  next?: string;
  context: TwoFactorSetupProps["context"];
  onDone: (codes: string[], next: string) => void;
  onWrongPassword: () => void;
};

/** The code from their app or their inbox that confirms the new method works. */
const ConfirmCode = ({
  method,
  next,
  onDone,
}: Pick<MethodStepProps, "next" | "onDone"> & { method: TwoFactorMethod }) => {
  const t = useTranslations("Admin.auth");
  const confirm = method === "authenticator" ? confirmAuthenticatorSetup : confirmEmailSetup;
  const { register, submit, fieldError, error, isSubmitting } = useAuthForm({
    schema: totpCodeSchema,
    defaultValues: { code: "" },
    action: (values) => confirm(values, next),
    onSuccess: (result) => onDone(result.recoveryCodes, result.next ?? "/admin"),
  });
  const codeError = fieldError("code");

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <AuthAlert>{error && t(`errors.${error}`)}</AuthAlert>
      <TextField
        id={`setup-${method}-code`}
        label={t("twoFactor.code")}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        className={codeInputClass}
        error={codeError && t(`errors.${codeError}` as Parameters<typeof t>[0])}
        {...register("code")}
      />
      <AuthSubmit
        isSubmitting={isSubmitting}
        label={t("setup.submit")}
        submittingLabel={t("twoFactor.submitting")}
      />
    </form>
  );
};

const SetupFailed = ({ error, context }: { error: AuthError | "unknown"; context: string }) => {
  const t = useTranslations("Admin.auth");
  return (
    <div className="flex flex-col gap-3">
      <AuthAlert>{t(`errors.${error}`)}</AuthAlert>
      {context === "invite" && error === "expired" && <StartOver />}
    </div>
  );
};

/** Scan the QR code, then confirm a code from the app. */
const AuthenticatorStep = ({
  password,
  next,
  context,
  onDone,
  onWrongPassword,
}: MethodStepProps) => {
  const t = useTranslations("Admin.auth");
  const setup = useAuthenticatorSetup(password);
  const { copied, copy } = useCopy();

  const wrongPassword = setup.status === "failed" && setup.error === "wrongPassword";
  useEffect(() => {
    if (wrongPassword) onWrongPassword();
  }, [wrongPassword, onWrongPassword]);

  if (setup.status === "loading" || wrongPassword) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        {t("setup.loading")}
      </p>
    );
  }
  if (setup.status === "failed") return <SetupFailed error={setup.error} context={context} />;

  return (
    <ol className="flex flex-col gap-6">
      <li className="flex flex-col gap-3">
        <p className="text-sm">{t("setup.step1")}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made on the server */}
        <img
          src={setup.qrCode}
          alt={t("setup.qrAlt")}
          width={192}
          height={192}
          className="self-center rounded-lg bg-white p-2"
        />
        <p className="text-muted-foreground text-sm">{t("setup.manual")}</p>
        <div className="flex items-center gap-2">
          <code className="bg-muted flex-1 rounded-lg px-3 py-2 font-mono text-sm break-all">
            {setup.secret}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon-touch"
            aria-label={copied ? t("setup.copied") : t("setup.copyKey")}
            onClick={() => copy(setup.secret.replace(/\s/g, ""))}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
        </div>
      </li>
      <li className="flex flex-col gap-3">
        <p className="text-sm">{t("setup.step2")}</p>
        <ConfirmCode method="authenticator" next={next} onDone={onDone} />
      </li>
    </ol>
  );
};

/** Sends a code to their address on request, then confirms it. */
const EmailStep = ({
  email,
  password,
  next,
  context,
  onDone,
  onWrongPassword,
}: MethodStepProps & { email: string }) => {
  const t = useTranslations("Admin.auth");
  const [isSending, startSend] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<AuthError | "unknown" | null>(null);

  const send = () =>
    startSend(async () => {
      setError(null);
      try {
        const result = await beginEmailSetup(password);
        if (result.ok) setSent(true);
        else if (result.error === "wrongPassword") onWrongPassword();
        else setError(result.error);
      } catch {
        setError("unknown");
      }
    });

  return (
    <div className="flex flex-col gap-5">
      {sent ? (
        <AuthNotice>{t("setup.emailSent", { email })}</AuthNotice>
      ) : (
        <p className="text-sm">{t("setup.emailStep", { email })}</p>
      )}
      {error && <SetupFailed error={error} context={context} />}
      {sent && <ConfirmCode method="email" next={next} onDone={onDone} />}
      <Button
        type="button"
        size="touch"
        variant={sent ? "outline" : "default"}
        className="w-full"
        disabled={isSending}
        onClick={send}
      >
        {isSending ? t("setup.sending") : sent ? t("twoFactor.resend") : t("setup.sendCode")}
      </Button>
    </div>
  );
};

/**
 * Setting up or changing the second step: choose a method, confirm the current password if
 * already signed in, prove the method works, then save the new recovery codes.
 */
export const TwoFactorSetup = ({
  email,
  next,
  required,
  context,
  methods,
  method,
  showHeading = true,
  onFinished,
}: TwoFactorSetupProps) => {
  const t = useTranslations("Admin.auth.setup");
  const router = useRouter();
  const needsPassword = context === "signedIn";
  const firstStep = (chosen: TwoFactorMethod): Step =>
    needsPassword ? { kind: "password", method: chosen } : { kind: "method", method: chosen };
  const [step, setStep] = useState<Step>(method ? firstStep(method) : { kind: "choose" });

  if (step.kind === "codes") {
    return (
      <>
        {showHeading && <AuthHeading title={t("codesTitle")} lead={t("codesLead")} />}
        {!showHeading && <p className="text-muted-foreground mb-4 text-sm">{t("codesLead")}</p>}
        <RecoveryCodes codes={step.codes} />
        <Button
          type="button"
          size="touch"
          className="mt-6 w-full"
          onClick={() => (onFinished ? onFinished() : router.replace(step.next))}
        >
          {t("continue")}
        </Button>
      </>
    );
  }

  const stepProps: MethodStepProps = {
    password: step.kind === "method" ? step.password : undefined,
    next,
    context,
    onDone: (codes, to) => setStep({ kind: "codes", codes, next: to }),
    onWrongPassword: () =>
      step.kind === "method" &&
      setStep({ kind: "password", method: step.method, error: "wrongPassword" }),
  };
  const canGoBack = step.kind !== "choose" && !method && methods.length > 1;

  return (
    <>
      {showHeading && <AuthHeading title={t("title")} lead={t("lead")} />}
      {step.kind === "choose" && (
        <p className="text-muted-foreground mb-4 text-sm">
          {required ? t("required") : t("optional")}
        </p>
      )}
      {step.kind === "choose" && (
        <ChooseMethod
          email={email}
          methods={methods}
          canSkip={context === "invite" && !required}
          next={next}
          onChoose={(chosen) => setStep(firstStep(chosen))}
        />
      )}
      {step.kind === "password" && (
        <PasswordStep
          error={step.error}
          onContinue={(password) => setStep({ kind: "method", method: step.method, password })}
        />
      )}
      {step.kind === "method" && step.method === "authenticator" && (
        <AuthenticatorStep {...stepProps} />
      )}
      {step.kind === "method" && step.method === "email" && (
        <EmailStep email={email} {...stepProps} />
      )}
      {canGoBack && (
        <Button
          type="button"
          variant="link"
          className="mt-4 h-auto min-h-11 px-0"
          onClick={() => setStep({ kind: "choose" })}
        >
          {t("choose.back")}
        </Button>
      )}
    </>
  );
};

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ComponentProps, type ReactNode, useState } from "react";
import { Controller, type FieldError, useForm, useWatch } from "react-hook-form";

import { DatePicker } from "@/components/admin/date-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { TabList } from "@/components/admin/tab-list";
import { TabPanel } from "@/components/admin/tab-panel";
import { TextField } from "@/components/donation/text-field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { donationConfig, FUND_IDS, type FundId } from "@/config/donation";
import type { Locale } from "@/i18n/routing";
import { createStory, updateStory } from "@/lib/admin/story-actions";
import type { AdminStory } from "@/lib/admin/story-queries";
import { startOfDay, toDateInput } from "@/lib/admin/catalog-schema";
import {
  slugify,
  STORY_FIELD_LIMITS,
  STORY_IMAGE_MAX_BYTES,
  STORY_IMAGE_TYPES,
  STORY_LOCALES,
  STORY_SOURCE_LOCALE,
  STORY_TEXT_FIELDS,
  type StoryError,
  type StoryFormInput,
  storyFormSchema,
  type StoryFormValues,
  type StoryTextField,
  toFormContent,
} from "@/lib/stories/story-schema";
import { cn } from "@/lib/utils";

type SignedUpload = { uploadUrl: string; fields: Record<string, string> };

/**
 * Uploads an image straight to Cloudinary with a signature from our server, and returns its
 * address with automatic format and quality, so each browser gets a light version.
 */
const uploadStoryImage = async (file: File) => {
  const signing = await fetch("/api/admin/story-images", { method: "POST" });
  if (!signing.ok) throw new Error(`Signing failed with ${signing.status}`);
  const { uploadUrl, fields } = (await signing.json()) as SignedUpload;

  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  body.append("file", file);
  const upload = await fetch(uploadUrl, { method: "POST", body });
  if (!upload.ok) throw new Error(`Upload failed with ${upload.status}`);
  const { secure_url: url } = (await upload.json()) as { secure_url: string };
  return url.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
};

const today = () => new Date().toISOString().slice(0, 10);

const toDefaults = (story: AdminStory | null): StoryFormInput => ({
  slug: story?.slug ?? "",
  fundId: (story?.fundId as FundId | undefined) ?? donationConfig.defaultFundId,
  publishedOn: story?.publishedOn ?? today(),
  status: story?.status ?? "draft",
  isFeatured: story?.isFeatured ?? false,
  isSample: story?.isSample ?? false,
  content: toFormContent(story?.content ?? null),
});

const TEXTAREA_FIELDS: ReadonlySet<StoryTextField> = new Set(["summary", "quote"]);

type TextAreaFieldProps = ComponentProps<"textarea"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

const TextAreaField = ({ id, label, hint, error, ...props }: TextAreaFieldProps) => (
  <div className="flex flex-col gap-2">
    <label htmlFor={id} className="text-sm font-medium">
      {label}
    </label>
    {hint && (
      <p id={`${id}-hint`} className="text-muted-foreground -mt-1 text-sm">
        {hint}
      </p>
    )}
    <Textarea
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={
        [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined
      }
      className="bg-background min-h-20 px-3 py-2.5 md:text-base"
      {...props}
    />
    {error && (
      <p id={`${id}-error`} className="text-destructive text-sm">
        {error}
      </p>
    )}
  </div>
);

type SwitchFieldProps = {
  id: string;
  label: ReactNode;
  hint: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const SwitchField = ({ id, label, hint, checked, onCheckedChange }: SwitchFieldProps) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex flex-col gap-1">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      <span id={`${id}-hint`} className="text-muted-foreground text-sm">
        {hint}
      </span>
    </div>
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-hint`}
      className="mt-1"
    />
  </div>
);

/** Write a new story or edit one: each language's text and body, then how it's published. */
export const StoryForm = ({
  story,
  canUploadImages,
}: {
  story: AdminStory | null;
  /** False until Cloudinary is set up; the editor then has no image button. */
  canUploadImages: boolean;
}) => {
  const t = useTranslations("Admin.stories");
  const tFunds = useTranslations("Funds");
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(STORY_SOURCE_LOCALE);
  const [error, setError] = useState<StoryError | "unknown" | null>(null);
  // A new story's link name follows its English title until someone edits it.
  const [slugEdited, setSlugEdited] = useState(story !== null);

  const form = useForm<StoryFormInput, unknown, StoryFormValues>({
    resolver: zodResolver(storyFormSchema),
    defaultValues: toDefaults(story),
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { errors, isSubmitting } = form.formState;

  const fieldMessage = (fieldError: FieldError | undefined, field: string) => {
    if (!fieldError) return undefined;
    if (fieldError.type === "slugTaken") return t("errors.slugTaken");
    if (fieldError.message === "required" || fieldError.message === "incomplete") {
      return t(`form.errors.${fieldError.message}`);
    }
    if (fieldError.type === "too_big" && field in STORY_FIELD_LIMITS) {
      return t("form.errors.tooLong", { max: STORY_FIELD_LIMITS[field as StoryTextField] });
    }
    if (field === "slug" || field === "fundId" || field === "publishedOn") {
      return t(`form.errors.${field}`);
    }
    return t("form.errors.required");
  };

  const localeHasErrors = (value: Locale) => errors.content?.[value] !== undefined;

  const submit = form.handleSubmit(
    async (values) => {
      setError(null);
      try {
        const result = story ? await updateStory(story.id, values) : await createStory(values);
        if (result.ok) {
          router.push(`/admin/stories?saved=${result.id}${story ? "" : "&new=1"}`);
        } else if (result.error === "slugTaken") {
          form.setError("slug", { type: "slugTaken" }, { shouldFocus: true });
        } else {
          setError(result.error);
        }
      } catch {
        setError("unknown");
      }
    },
    (invalid) => {
      // Show the first language with a problem, so the highlighted field is on screen.
      const withErrors = STORY_LOCALES.find((value) => invalid.content?.[value] !== undefined);
      if (withErrors) setLocale(withErrors);
    },
  );

  const fundItems = FUND_IDS.map((id) => ({ value: id, label: tFunds(`${id}.name`) }));
  const publishedOn = useWatch({ control: form.control, name: "publishedOn" });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <Link
        href="/admin/stories"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium transition-colors"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("backToStories")}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <TabList
            label={t("form.languagesLabel")}
            tab={locale}
            onTabChange={(value) => setLocale(value as Locale)}
            tabs={STORY_LOCALES.map((value) => ({
              value,
              label: localeHasErrors(value)
                ? `${t(`form.locales.${value}`)} – ${t("form.needsAttention")}`
                : t(`form.locales.${value}`),
              icon: localeHasErrors(value) ? CircleAlert : undefined,
            }))}
          />

          {STORY_LOCALES.map((value) => (
            <TabPanel key={value} value={value} selected={locale} className="outline-none">
              <div className="bg-card ring-foreground/10 flex flex-col gap-5 rounded-2xl p-5 ring-1">
                <p className="text-muted-foreground text-sm">
                  {t(`form.localeHint.${value === STORY_SOURCE_LOCALE ? "source" : "other"}`)}
                </p>

                {STORY_TEXT_FIELDS.map((field) => {
                  const id = `story-${value}-${field}`;
                  const registered = form.register(`content.${value}.${field}`, {
                    onChange:
                      value === STORY_SOURCE_LOCALE && field === "title" && !slugEdited
                        ? (event: { target: { value: string } }) =>
                            form.setValue("slug", slugify(event.target.value))
                        : undefined,
                  });
                  const props = {
                    id,
                    label: t(`form.${field}`),
                    hint: t(`form.${field}Hint`),
                    maxLength: STORY_FIELD_LIMITS[field],
                    error: fieldMessage(errors.content?.[value]?.[field], field),
                    lang: value,
                    ...registered,
                  };
                  return TEXTAREA_FIELDS.has(field) ? (
                    <TextAreaField key={field} rows={field === "summary" ? 3 : 2} {...props} />
                  ) : (
                    <TextField key={field} autoComplete="off" {...props} />
                  );
                })}

                <div className="flex flex-col gap-2">
                  <span id={`story-${value}-body-label`} className="text-sm font-medium">
                    {t("form.body")}
                  </span>
                  <p
                    id={`story-${value}-body-hint`}
                    className="text-muted-foreground -mt-1 text-sm"
                  >
                    {t(canUploadImages ? "form.bodyHint" : "form.bodyHintNoImages")}
                  </p>
                  <Controller
                    control={form.control}
                    name={`content.${value}.body`}
                    render={({ field, fieldState }) => (
                      <>
                        <RichTextEditor
                          value={field.value}
                          onValueChange={field.onChange}
                          uploadImage={canUploadImages ? uploadStoryImage : undefined}
                          maxImageBytes={STORY_IMAGE_MAX_BYTES}
                          acceptImageTypes={STORY_IMAGE_TYPES}
                          aria-labelledby={`story-${value}-body-label`}
                          aria-describedby={cn(
                            `story-${value}-body-hint`,
                            fieldState.error && `story-${value}-body-error`,
                          )}
                          aria-invalid={fieldState.error ? true : undefined}
                          editorClassName="min-h-96"
                        />
                        {fieldState.error && (
                          <p id={`story-${value}-body-error`} className="text-destructive text-sm">
                            {fieldMessage(fieldState.error, "body")}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>
              </div>
            </TabPanel>
          ))}
        </div>

        <aside className="bg-card ring-foreground/10 flex flex-col gap-5 rounded-2xl p-5 ring-1 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">{t("form.publishing")}</h2>

          <TextField
            id="story-slug"
            label={t("form.slug")}
            hint={t("form.slugHint")}
            autoComplete="off"
            spellCheck={false}
            error={fieldMessage(errors.slug, "slug")}
            {...form.register("slug", { onChange: () => setSlugEdited(true) })}
          />

          <Controller
            control={form.control}
            name="fundId"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                <label id="story-fund-label" htmlFor="story-fund" className="text-sm font-medium">
                  {t("form.fund")}
                </label>
                <p id="story-fund-hint" className="text-muted-foreground -mt-1 text-sm">
                  {t("form.fundHint")}
                </p>
                <Select
                  items={fundItems}
                  value={field.value}
                  onValueChange={(next) => {
                    if (typeof next === "string") field.onChange(next);
                  }}
                >
                  <SelectTrigger
                    id="story-fund"
                    aria-labelledby="story-fund-label"
                    aria-describedby="story-fund-hint"
                    className="bg-background h-11 w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fundItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />

          <div className="flex flex-col gap-2">
            <DatePicker
              type="single"
              label={t("form.publishedOn")}
              value={startOfDay(publishedOn) ?? undefined}
              onValueChange={(date) =>
                form.setValue("publishedOn", date ? toDateInput(date) : "", {
                  shouldValidate: true,
                })
              }
              error={!!errors.publishedOn}
            />
            <p className="text-muted-foreground text-sm">{t("form.publishedOnHint")}</p>
            {errors.publishedOn && (
              <p className="text-destructive text-sm">
                {fieldMessage(errors.publishedOn, "publishedOn")}
              </p>
            )}
          </div>

          <div className="border-border flex flex-col gap-4 border-t pt-5">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <SwitchField
                  id="story-published"
                  label={t("form.published")}
                  hint={t("form.publishedHint")}
                  checked={field.value === "published"}
                  onCheckedChange={(checked) => field.onChange(checked ? "published" : "draft")}
                />
              )}
            />
            {(["isFeatured", "isSample"] as const).map((name) => (
              <Controller
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <SwitchField
                    id={`story-${name}`}
                    label={t(`form.${name}`)}
                    hint={t(`form.${name}Hint`)}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            ))}
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {t(`errors.${error}`)}
            </p>
          )}
          {!error && Object.keys(errors).length > 0 && (
            <p role="alert" className="text-destructive text-sm">
              {t("errors.invalid")}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button type="submit" size="touch" disabled={isSubmitting}>
              {isSubmitting ? t("form.saving") : story ? t("form.save") : t("form.create")}
            </Button>
            <Button
              type="button"
              size="touch"
              variant="outline"
              onClick={() => router.push("/admin/stories")}
            >
              {t("form.cancel")}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
};

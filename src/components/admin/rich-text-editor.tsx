"use client";

import { Check, ImageIcon, ImagePlus, Link2, Link2Off, LoaderCircle, Palette } from "lucide-react";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useTranslations } from "next-intl";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  EDITOR_BUTTON_GROUPS,
  EDITOR_COLORS,
  type EditorButtonConfig,
  readToolbarState,
} from "@/config/editor";

/** Turns what someone typed into a link address, or null when it isn't a web address. */
export const normalizeLinkHref = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url.href;
  } catch {
    return null;
  }
};

const createExtensions = (placeholder: string) => [
  StarterKit.configure({
    code: false,
    codeBlock: false,
    heading: { levels: [2, 3] },
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https"],
      isAllowedUri: (url) => normalizeLinkHref(url) !== null,
      shouldAutoLink: (url) => normalizeLinkHref(url) !== null,
    },
  }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  Subscript,
  Superscript,
  TextAlign.configure({
    types: ["heading", "paragraph"],
    alignments: ["left", "center", "right", "justify"],
  }),
  Image.configure({
    allowBase64: false,
    resize: {
      enabled: true,
      directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
      minWidth: 80,
      minHeight: 40,
      alwaysPreserveAspectRatio: true,
    },
  }),
  Placeholder.configure({ placeholder }),
];

export type UploadImage = (file: File) => Promise<string>;

const ToolbarButton = ({
  label,
  icon: Icon,
  onClick,
  disabled,
  isActive,
}: Omit<EditorButtonConfig, "label"> & { label: string }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    title={label}
    aria-label={label}
    aria-pressed={isActive}
    disabled={disabled}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className="aria-pressed:bg-primary/10 aria-pressed:text-primary"
  >
    <Icon aria-hidden="true" />
  </Button>
);

const Separator = () => <span aria-hidden="true" className="bg-border mx-1 h-5 w-px shrink-0" />;

/** Add, change or remove the link on the selected text. */
const LinkControl = ({
  editor,
  href,
  isLink,
}: {
  editor: Editor;
  href: string;
  isLink: boolean;
}) => {
  const t = useTranslations("Admin.stories.editor.link");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  const apply = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const next = normalizeLinkHref(value);
    if (!next) {
      setInvalid(true);
      return;
    }
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !isLink) {
      chain
        .insertContent({
          type: "text",
          text: value.trim(),
          marks: [{ type: "link", attrs: { href: next } }],
        })
        .run();
    } else {
      chain.extendMarkRange("link").setLink({ href: next }).run();
    }
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValue(href);
          setInvalid(false);
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t("button")}
            aria-label={t("button")}
            aria-pressed={isLink}
            onMouseDown={(event) => event.preventDefault()}
            className="aria-pressed:bg-primary/10 aria-pressed:text-primary"
          />
        }
      >
        <Link2 aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={apply} className="flex flex-col gap-2">
          <label htmlFor={id} className="text-sm font-medium">
            {t("label")}
          </label>
          <Input
            id={id}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            value={value}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
            }}
            className="h-9"
          />
          {invalid && (
            <p id={`${id}-error`} className="text-destructive text-sm">
              {t("invalid")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {isLink && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setOpen(false);
                }}
              >
                <Link2Off aria-hidden="true" />
                {t("remove")}
              </Button>
            )}
            <Button type="submit" size="sm">
              {t("apply")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};

const ColorControl = ({ editor, color }: { editor: Editor; color: string | null }) => {
  const t = useTranslations("Admin.stories.editor");
  const [open, setOpen] = useState(false);
  const pick = (value: string | null) => {
    const chain = editor.chain().focus();
    if (value) chain.setColor(value).run();
    else chain.unsetColor().run();
    setOpen(false);
  };
  const swatches = [{ key: "default", value: null }, ...EDITOR_COLORS] as const;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t("textColor")}
            aria-label={t("textColor")}
            onMouseDown={(event) => event.preventDefault()}
          />
        }
      >
        <Palette aria-hidden="true" style={color ? { color } : undefined} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <div role="group" aria-label={t("textColor")} className="flex gap-1.5">
          {swatches.map(({ key, value }) => {
            const selected = (color ?? null) === value;
            return (
              <button
                key={key}
                type="button"
                title={t(`colors.${key}`)}
                aria-label={t(`colors.${key}`)}
                aria-pressed={selected}
                onClick={() => pick(value)}
                className="ring-foreground/15 focus-visible:outline-ring grid size-8 place-items-center rounded-full ring-1 focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: value ?? "var(--foreground)" }}
              >
                {selected && <Check aria-hidden="true" className="text-background size-4" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** Alt text for the selected image. */
const ImageAltControl = ({ editor, alt }: { editor: Editor; alt: string }) => {
  const t = useTranslations("Admin.stories.editor.image");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(alt);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(event) => event.preventDefault()}
            className="h-8"
          />
        }
      >
        <ImageIcon aria-hidden="true" />
        {t("describe")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            editor.chain().focus().updateAttributes("image", { alt: value.trim() }).run();
            setOpen(false);
          }}
        >
          <label htmlFor={id} className="text-sm font-medium">
            {t("altLabel")}
          </label>
          <p id={`${id}-hint`} className="text-muted-foreground text-sm">
            {t("altHint")}
          </p>
          <Input
            id={id}
            autoComplete="off"
            value={value}
            maxLength={300}
            aria-describedby={`${id}-hint`}
            onChange={(event) => setValue(event.target.value)}
            className="h-9"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              {t("apply")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};

type ImageStatus = "uploading" | "tooLarge" | "type" | "failed" | null;

const TopBar = ({
  editor,
  onPickImage,
  imageStatus,
}: {
  editor: Editor;
  onPickImage?: () => void;
  imageStatus: ImageStatus;
}) => {
  const t = useTranslations("Admin.stories.editor");
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => readToolbarState(current),
  });
  const groups = EDITOR_BUTTON_GROUPS(editor, state);

  return (
    <div className="bg-muted/40 border-border sticky top-16 z-10 flex flex-col border-b">
      <div
        role="toolbar"
        aria-label={t("toolbarLabel")}
        className="flex flex-wrap items-center gap-0.5 p-1.5"
      >
        {groups.map((group, index) => (
          <div key={group.label} className="flex items-center gap-0.5">
            {index > 0 && <Separator />}
            {group.buttons.map(({ label, ...button }) => (
              <ToolbarButton key={label} label={t(label)} {...button} />
            ))}
            {group.label === "text_style" && <ColorControl editor={editor} color={state.color} />}
          </div>
        ))}
        <Separator />
        <LinkControl editor={editor} href={state.linkHref} isLink={state.isLink} />
        {onPickImage && (
          <ToolbarButton
            label={t("image.button")}
            icon={imageStatus === "uploading" ? LoaderCircle : ImagePlus}
            disabled={imageStatus === "uploading"}
            onClick={onPickImage}
          />
        )}
        {state.isImage && <ImageAltControl editor={editor} alt={state.imageAlt} />}
      </div>
      <p aria-live="polite" className="px-3 pb-1.5 text-sm empty:hidden">
        {imageStatus === "uploading" && (
          <span className="text-muted-foreground">{t("image.uploading")}</span>
        )}
        {imageStatus && imageStatus !== "uploading" && (
          <span className="text-destructive">{t(`image.${imageStatus}`)}</span>
        )}
      </p>
    </div>
  );
};

interface Props {
  onValueChange: (value: string) => void;
  value: string;
  className?: string;
  editorClassName?: string;
  initialValue?: string;
  editable?: boolean;
  placeholder?: string;
  /** Stores a picked, pasted or dropped image and returns its address. Without it, no images. */
  uploadImage?: UploadImage;
  /** Images bigger than this are refused before upload. */
  maxImageBytes?: number;
  acceptImageTypes?: readonly string[];
  id?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export const RichTextEditor = ({
  onValueChange,
  value,
  className,
  editable = true,
  editorClassName,
  initialValue,
  placeholder,
  uploadImage,
  maxImageBytes = Infinity,
  acceptImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"],
  id,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: Props) => {
  const t = useTranslations("Admin.stories.editor");
  const fileInput = useRef<HTMLInputElement>(null);
  const [imageStatus, setImageStatus] = useState<ImageStatus>(null);
  const extensions = useMemo(
    () => createExtensions(placeholder ?? t("placeholder")),
    [placeholder, t],
  );

  const insertImages = async (editor: Editor, files: File[], at?: number) => {
    if (!uploadImage) return;
    for (const file of files) {
      if (!acceptImageTypes.includes(file.type)) {
        setImageStatus("type");
        return;
      }
      if (file.size > maxImageBytes) {
        setImageStatus("tooLarge");
        return;
      }
    }
    setImageStatus("uploading");
    try {
      for (const file of files) {
        const src = await uploadImage(file);
        const chain = editor.chain().focus();
        if (at !== undefined)
          chain.insertContentAt(at, { type: "image", attrs: { src, alt: "" } }).run();
        else chain.setImage({ src, alt: "" }).run();
      }
      setImageStatus(null);
    } catch {
      setImageStatus("failed");
    }
  };

  const editorRef = useRef<Editor | null>(null);
  const imageFiles = (list: FileList | null | undefined) =>
    Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));

  const editor = useEditor({
    extensions,
    content: initialValue || value,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onValueChange(current.getHTML()),
    editorProps: {
      attributes: {
        ...(id && { id }),
        role: "textbox",
        "aria-multiline": "true",
        ...(labelledBy && { "aria-labelledby": labelledBy }),
        ...(describedBy && { "aria-describedby": describedBy }),
        ...(invalid && { "aria-invalid": "true" }),
        class: cn("story-body story-body--editor min-h-72 focus:outline-none", editorClassName),
      },
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length || !uploadImage || !editorRef.current) return false;
        event.preventDefault();
        insertImagesRef.current(editorRef.current, files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (moved || !files.length || !uploadImage || !editorRef.current) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        insertImagesRef.current(editorRef.current, files, at);
        return true;
      },
    },
  });

  // The paste and drop handlers are set up once, so they read the editor and the latest upload
  // function through refs.
  const insertImagesRef = useRef(insertImages);
  useEffect(() => {
    insertImagesRef.current = insertImages;
    editorRef.current = editor;
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  return (
    <div
      className={cn(
        "border-input bg-background focus-within:border-ring focus-within:ring-ring/50 flex w-full flex-col rounded-lg border transition-[color,box-shadow] focus-within:ring-3",
        invalid && "border-destructive ring-destructive/20 ring-3",
        !editable && "bg-muted/30 opacity-60",
        className,
      )}
    >
      {editor && editable && (
        <TopBar
          editor={editor}
          imageStatus={imageStatus}
          onPickImage={uploadImage ? () => fileInput.current?.click() : undefined}
        />
      )}
      {uploadImage && (
        <input
          ref={fileInput}
          type="file"
          accept={acceptImageTypes.join(",")}
          multiple
          hidden
          tabIndex={-1}
          onChange={(event) => {
            const files = imageFiles(event.target.files);
            event.target.value = "";
            if (editor && files.length) insertImages(editor, files);
          }}
        />
      )}
      <EditorContent
        editor={editor}
        className={cn("px-4 py-3", !editable && "cursor-not-allowed")}
      />
    </div>
  );
};

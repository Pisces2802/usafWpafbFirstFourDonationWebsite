import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo2,
} from "lucide-react";

/** What the toolbar needs to know about the selection; read with `useEditorState`. */
export type EditorToolbarState = {
  canUndo: boolean;
  canRedo: boolean;
  isParagraph: boolean;
  isHeading2: boolean;
  isHeading3: boolean;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isSubscript: boolean;
  isSuperscript: boolean;
  isHighlight: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isBlockquote: boolean;
  align: "left" | "center" | "right" | "justify" | null;
  isLink: boolean;
  linkHref: string;
  isImage: boolean;
  imageAlt: string;
  color: string | null;
};

export const readToolbarState = (editor: Editor): EditorToolbarState => ({
  canUndo: editor.can().undo(),
  canRedo: editor.can().redo(),
  isParagraph: editor.isActive("paragraph"),
  isHeading2: editor.isActive("heading", { level: 2 }),
  isHeading3: editor.isActive("heading", { level: 3 }),
  isBold: editor.isActive("bold"),
  isItalic: editor.isActive("italic"),
  isUnderline: editor.isActive("underline"),
  isStrike: editor.isActive("strike"),
  isSubscript: editor.isActive("subscript"),
  isSuperscript: editor.isActive("superscript"),
  isHighlight: editor.isActive("highlight"),
  isBulletList: editor.isActive("bulletList"),
  isOrderedList: editor.isActive("orderedList"),
  isBlockquote: editor.isActive("blockquote"),
  align:
    (["left", "center", "right", "justify"] as const).find((value) =>
      editor.isActive({ textAlign: value }),
    ) ?? null,
  isLink: editor.isActive("link"),
  linkHref: (editor.getAttributes("link").href as string | undefined) ?? "",
  isImage: editor.isActive("image"),
  imageAlt: (editor.getAttributes("image").alt as string | undefined) ?? "",
  color: (editor.getAttributes("textStyle").color as string | undefined) ?? null,
});

/** Message keys under `Admin.stories.editor`. */
export type EditorButtonLabel =
  | "undo"
  | "redo"
  | "paragraph"
  | "heading2"
  | "heading3"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "subscript"
  | "superscript"
  | "highlight"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "divider"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "alignJustify";

export type EditorButtonConfig = {
  label: EditorButtonLabel;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  /** Set for buttons that toggle formatting on and off, read out as pressed or not. */
  isActive?: boolean;
};

export type EditorButtonGroup = {
  label: "history" | "blocks" | "text_style" | "lists" | "alignment";
  buttons: EditorButtonConfig[];
};

/** Text colors offered in the toolbar, keyed into `Admin.stories.editor.colors`. */
export const EDITOR_COLORS = [
  { key: "blue", value: "#1d4ed8" },
  { key: "red", value: "#b91c1c" },
  { key: "green", value: "#15803d" },
  { key: "amber", value: "#b45309" },
  { key: "gray", value: "#4b5563" },
] as const;

/**
 * The toolbar's plain buttons, in groups. Links, images and colors need a popover and are added by
 * the toolbar itself.
 */
export const EDITOR_BUTTON_GROUPS = (
  editor: Editor,
  state: EditorToolbarState,
): EditorButtonGroup[] => {
  const chain = () => editor.chain().focus();

  return [
    {
      label: "history",
      buttons: [
        {
          label: "undo",
          icon: Undo2,
          onClick: () => chain().undo().run(),
          disabled: !state.canUndo,
        },
        {
          label: "redo",
          icon: Redo2,
          onClick: () => chain().redo().run(),
          disabled: !state.canRedo,
        },
      ],
    },
    {
      label: "blocks",
      buttons: [
        {
          label: "paragraph",
          icon: Pilcrow,
          onClick: () => chain().setParagraph().run(),
          isActive: state.isParagraph,
        },
        {
          label: "heading2",
          icon: Heading2,
          onClick: () => chain().toggleHeading({ level: 2 }).run(),
          isActive: state.isHeading2,
        },
        {
          label: "heading3",
          icon: Heading3,
          onClick: () => chain().toggleHeading({ level: 3 }).run(),
          isActive: state.isHeading3,
        },
        {
          label: "blockquote",
          icon: Quote,
          onClick: () => chain().toggleBlockquote().run(),
          isActive: state.isBlockquote,
        },
        { label: "divider", icon: Minus, onClick: () => chain().setHorizontalRule().run() },
      ],
    },
    {
      label: "text_style",
      buttons: [
        {
          label: "bold",
          icon: Bold,
          onClick: () => chain().toggleBold().run(),
          isActive: state.isBold,
        },
        {
          label: "italic",
          icon: Italic,
          onClick: () => chain().toggleItalic().run(),
          isActive: state.isItalic,
        },
        {
          label: "underline",
          icon: Underline,
          onClick: () => chain().toggleUnderline().run(),
          isActive: state.isUnderline,
        },
        {
          label: "strike",
          icon: Strikethrough,
          onClick: () => chain().toggleStrike().run(),
          isActive: state.isStrike,
        },
        {
          label: "highlight",
          icon: Highlighter,
          onClick: () => chain().toggleHighlight().run(),
          isActive: state.isHighlight,
        },
        {
          label: "subscript",
          icon: Subscript,
          onClick: () => chain().unsetSuperscript().toggleSubscript().run(),
          isActive: state.isSubscript,
        },
        {
          label: "superscript",
          icon: Superscript,
          onClick: () => chain().unsetSubscript().toggleSuperscript().run(),
          isActive: state.isSuperscript,
        },
      ],
    },
    {
      label: "lists",
      buttons: [
        {
          label: "bulletList",
          icon: List,
          onClick: () => chain().toggleBulletList().run(),
          isActive: state.isBulletList,
        },
        {
          label: "orderedList",
          icon: ListOrdered,
          onClick: () => chain().toggleOrderedList().run(),
          isActive: state.isOrderedList,
        },
      ],
    },
    {
      label: "alignment",
      buttons: (
        [
          ["left", "alignLeft", AlignLeft],
          ["center", "alignCenter", AlignCenter],
          ["right", "alignRight", AlignRight],
          ["justify", "alignJustify", AlignJustify],
        ] as const
      ).map(([value, label, icon]) => ({
        label,
        icon,
        onClick: () =>
          state.align === value
            ? chain().unsetTextAlign().run()
            : chain().setTextAlign(value).run(),
        isActive: state.align === value,
      })),
    },
  ];
};

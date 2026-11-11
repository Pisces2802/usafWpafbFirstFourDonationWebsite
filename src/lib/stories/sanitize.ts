import "server-only";

import sanitizeHtml from "sanitize-html";

import { cloudinaryImagePrefix } from "@/lib/stories/cloudinary";

const COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*(?:,\s*[\d.]+%?\s*){2,3}\)|inherit)$/i;
const ALIGN = /^(?:left|right|center|justify)$/;
const PIXELS = /^\d{1,4}$/;

/** Story images come only from this site's Cloudinary account; never data: or anywhere else. */
const isAllowedImageSrc = (src: string) => {
  const prefix = cloudinaryImagePrefix();
  return prefix !== null && src.startsWith(prefix) && !/[\s"'<>]/.test(src);
};

const options = (): sanitizeHtml.IOptions => ({
  allowedTags: [
    "p",
    "br",
    "h2",
    "h3",
    "h4",
    "strong",
    "em",
    "u",
    "s",
    "sub",
    "sup",
    "mark",
    "span",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "img",
    "hr",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    mark: ["data-color", "style"],
    span: ["style"],
    p: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
  },
  allowedStyles: {
    p: { "text-align": [ALIGN] },
    h2: { "text-align": [ALIGN] },
    h3: { "text-align": [ALIGN] },
    h4: { "text-align": [ALIGN] },
    span: { color: [COLOR] },
    mark: { "background-color": [COLOR], color: [COLOR] },
  },
  allowedSchemes: ["http", "https"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  transformTags: {
    // A link to anything but a web address keeps its text and loses the link.
    a: (tagName, attribs): sanitizeHtml.Tag =>
      /^https?:\/\//i.test(attribs.href?.trim() ?? "")
        ? {
            tagName,
            attribs: { href: attribs.href!.trim(), target: "_blank", rel: "noopener noreferrer" },
          }
        : { tagName: "span", attribs: {} },
    img: (tagName, attribs) => {
      const { src = "", alt = "", title, width, height } = attribs;
      return {
        tagName,
        attribs: {
          src,
          alt,
          ...(title && { title }),
          ...(width && PIXELS.test(width) && { width }),
          ...(height && PIXELS.test(height) && { height }),
        },
      };
    },
  },
  exclusiveFilter: (frame) => frame.tag === "img" && !isAllowedImageSrc(frame.attribs.src ?? ""),
});

/**
 * Cleans story HTML from the editor down to the tags, attributes and styles the editor can make,
 * so nothing saved can run script or pull in content from elsewhere. Run on every save.
 */
export const sanitizeStoryHtml = (html: string) => sanitizeHtml(html, options()).trim();

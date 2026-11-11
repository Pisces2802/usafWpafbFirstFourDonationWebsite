import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/env";
import { STORY_IMAGE_FOLDER, STORY_IMAGE_FORMATS } from "@/lib/stories/story-schema";

/** Whether Cloudinary is set up, so the story editor can take images. */
export const cloudinaryConfigured = () => env.CLOUDINARY_CLOUD_NAME !== undefined;

/** Where this account's uploaded images are delivered from. */
export const cloudinaryImagePrefix = () =>
  env.CLOUDINARY_CLOUD_NAME
    ? `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`
    : null;

/**
 * Signs one direct browser upload to Cloudinary, following its signature rules: the parameters
 * sorted by name, joined as `key=value&…`, with the API secret appended, hashed with SHA-1. The
 * signature pins the folder and allowed formats, and Cloudinary rejects it after an hour.
 */
export const signStoryImageUpload = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return null;

  const params = {
    allowed_formats: STORY_IMAGE_FORMATS,
    folder: STORY_IMAGE_FOLDER,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const toSign = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const signature = createHash("sha1").update(`${toSign}${CLOUDINARY_API_SECRET}`).digest("hex");

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    fields: { ...params, api_key: CLOUDINARY_API_KEY, signature },
  };
};

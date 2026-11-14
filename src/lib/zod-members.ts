// The parts of Zod this app uses. Importing Zod's whole `z` namespace also ships every one of its
// ~40 interface languages to the browser (about 300 KB uncompressed), because `z.locales` can't be
// tree-shaken. Add a name here when a schema needs it.
export {
  array,
  boolean,
  coerce,
  config,
  email,
  enum,
  int,
  iso,
  literal,
  NEVER,
  number,
  object,
  preprocess,
  prettifyError,
  string,
  tuple,
  union,
  url,
  ZodType,
} from "zod";
export type { infer, input, output } from "zod";

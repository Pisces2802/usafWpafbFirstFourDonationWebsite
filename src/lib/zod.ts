import * as z from "./zod-members";

// Zod compiles object validators with `new Function` when it can. Our CSP blocks eval, so the
// first check in the browser logs a CSP violation. Interpreted validation is fast enough here.
z.config({ jitless: true });

/** Zod, configured for this app. Import `z` from here, not from "zod". */
export { z };

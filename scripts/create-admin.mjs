/**
 * Adds or updates a back-office user from the command line and prints a link for them. This is
 * how the first owner gets in, and how someone locked out gets back in, since only owners can
 * manage the team in the app.
 *
 *   pnpm admin:create --email you@example.org --name "Your Name" [--role owner]
 *   pnpm admin:create --email you@example.org --reset-2fa
 *
 * New people (and anyone who hasn't set a password) get a set-up link that confirms their email.
 * People who already have a password get a password reset link. --reset-2fa clears their
 * authenticator app and recovery codes, so they set two-step verification up again on next sign-in.
 * Every run restores access and ends their current sessions.
 *
 * Roles must match ADMIN_ROLES in src/lib/admin/permissions.ts, and token handling must match
 * src/lib/admin/auth (SHA-256 of a random base64url token).
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

import postgres from "postgres";

const ROLES = ["owner", "treasurer", "coordinator", "viewer"];
const SETUP_TTL_MS = 7 * 24 * 60 * 60_000;
const RESET_TTL_MS = 60 * 60_000;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) fail("DATABASE_URL isn't set. Add it to .env.local first.");
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string" },
    "reset-2fa": { type: "boolean", default: false },
  },
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
const role = values.role;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Pass a valid --email.");
if (role !== undefined && !ROLES.includes(role)) {
  fail(`--role must be one of: ${ROLES.join(", ")}.`);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

try {
  const user = await sql.begin(async (tx) => {
    const [existing] = await tx`select id, password_hash from admin_users where email = ${email}`;
    if (!existing && !name) fail('New people need --name, e.g. --name "Sam Lee".');

    const [row] = existing
      ? await tx`
          update admin_users set
            name = coalesce(${name ?? null}, name),
            role = coalesce(${role ?? null}::admin_role, role),
            is_active = true, failed_sign_in_count = 0, locked_until = null, updated_at = now()
          where id = ${existing.id}
          returning id, name, role, password_hash`
      : await tx`
          insert into admin_users (email, name, role)
          values (${email}, ${name}, ${role ?? "owner"})
          returning id, name, role, password_hash`;

    if (values["reset-2fa"]) {
      await tx`update admin_users set totp_secret = null, totp_last_step = null where id = ${row.id}`;
      await tx`delete from admin_recovery_codes where admin_user_id = ${row.id}`;
    }
    await tx`delete from admin_sessions where admin_user_id = ${row.id}`;
    await tx`
      insert into admin_audit_events (action, target_label, details)
      values ('team.updated_from_cli', ${`${row.name} <${email}>`}, ${sql.json({
        created: !existing,
        role: row.role,
        resetTwoFactor: values["reset-2fa"],
      })})`;

    const purpose = row.password_hash ? "reset_password" : "verify_email";
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const ttl = purpose === "verify_email" ? SETUP_TTL_MS : RESET_TTL_MS;
    await tx`delete from admin_tokens where admin_user_id = ${row.id} and purpose = ${purpose} and used_at is null`;
    await tx`
      insert into admin_tokens (admin_user_id, purpose, token_hash, expires_at)
      values (${row.id}, ${purpose}, ${tokenHash}, ${new Date(Date.now() + ttl)})`;

    const page = purpose === "verify_email" ? "verify-email" : "reset-password";
    return { ...row, created: !existing, purpose, link: `${siteUrl}/admin/${page}?token=${token}` };
  });

  console.log(`${user.created ? "Added" : "Updated"} ${user.name} <${email}> as ${user.role}.`);
  if (values["reset-2fa"]) console.log("Two-step verification was reset.");
  console.log(
    user.purpose === "verify_email"
      ? "\nSet-up link (works once, expires in 7 days):"
      : "\nPassword reset link (works once, expires in 1 hour):",
  );
  console.log(user.link);
} catch (error) {
  if (error.code === "42P01" || error.code === "42703") {
    fail("The database is missing back-office tables or columns. Run pnpm db:migrate.");
  }
  throw error;
} finally {
  await sql.end();
}

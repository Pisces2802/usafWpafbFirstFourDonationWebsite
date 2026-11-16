/**
 * Adds or updates a back-office user from the command line and prints a link for them. This is
 * how the first SuperAdmin gets in, and how someone locked out gets back in when nobody in the
 * app can let them in.
 *
 *   pnpm admin:create --email you@example.org --name "Your Name" [--role super-admin]
 *   pnpm admin:create --email you@example.org --reset-2fa
 *
 * New people (and anyone who hasn't set a password) get a set-up link that confirms their email.
 * People who already have a password get a password reset link. --reset-2fa clears their
 * second step and recovery codes, so they set two-step verification up again on next sign-in.
 * Every run restores access, unlocks them and ends their current sessions.
 *
 * --role takes a role's slug from the admin_roles table (super-admin, identity-manager, finance,
 * coordinator, auditor or viewer). New people default to super-admin while there isn't one,
 * since this is how the first person gets in; after that --role is needed.
 *
 * There's one SuperAdmin at a time, and normally they hand it over from the Team page. If they
 * can't (they've left, or lost their account), --role super-admin --replace-super-admin makes
 * this person SuperAdmin and the old one an IdentityManager.
 *
 * Token handling must match
 * src/lib/admin/auth (SHA-256 of a random base64url token).
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

import postgres from "postgres";

const SETUP_TTL_MS = 7 * 24 * 60 * 60_000;
const RESET_TTL_MS = 60 * 60_000;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) fail("DATABASE_URL isn't set. Add it to .env.local first.");
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001").replace(/\/+$/, "");

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string" },
    "reset-2fa": { type: "boolean", default: false },
    "replace-super-admin": { type: "boolean", default: false },
  },
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
const role = values.role;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Pass a valid --email.");

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

try {
  const user = await sql.begin(async (tx) => {
    const [existing] = await tx`select id, password_hash from admin_users where email = ${email}`;
    if (!existing && !name) fail('New people need --name, e.g. --name "Sam Lee".');

    // Locking the SuperAdmin role makes a run that changes who holds it wait for any other.
    const [superRole] = await tx`select id from admin_roles where is_super for update`;
    const [holder] = await tx`
      select id, name, email from admin_users where role_id = ${superRole.id} limit 1`;

    if (!existing && !role && holder) {
      fail(`There's already a SuperAdmin (${holder.email}). Pass --role for new people.`);
    }
    const slug = role ?? (existing ? null : "super-admin");
    let roleId = null;
    if (slug) {
      const [found] = await tx`select id from admin_roles where slug = ${slug}`;
      if (!found) {
        const slugs = await tx`select slug from admin_roles where slug is not null order by id`;
        fail(`--role must be one of: ${slugs.map((r) => r.slug).join(", ")}.`);
      }
      roleId = found.id;
    }

    if (roleId === superRole.id && holder && holder.id !== existing?.id) {
      if (!values["replace-super-admin"]) {
        fail(
          `${holder.email} is the SuperAdmin, and there's one at a time. They can hand it over ` +
            "from the Team page, or add --replace-super-admin to make them an IdentityManager.",
        );
      }
      await tx`
        update admin_users set
          role_id = (select id from admin_roles where slug = 'identity-manager'), updated_at = now()
        where id = ${holder.id}`;
      await tx`delete from admin_sessions where admin_user_id = ${holder.id}`;
      await tx`
        insert into admin_audit_events (action, target_label, details)
        values ('team.updated_from_cli', ${`${holder.name} <${holder.email}>`}, ${sql.json({
          created: false,
          role: "IdentityManager",
          resetTwoFactor: false,
        })})`;
      console.log(`${holder.name} <${holder.email}> is now an IdentityManager.`);
    }

    const [row] = existing
      ? await tx`
          update admin_users set
            name = coalesce(${name ?? null}, name),
            role_id = coalesce(${roleId}::integer, role_id),
            is_active = true, failed_sign_in_count = 0, locked_until = null,
            suspended_at = null, suspended_by_id = null, suspend_reason = null, updated_at = now()
          where id = ${existing.id}
          returning id, name, role_id, password_hash`
      : await tx`
          insert into admin_users (email, name, role_id)
          values (${email}, ${name}, ${roleId})
          returning id, name, role_id, password_hash`;
    const [{ name: roleName }] = await tx`select name from admin_roles where id = ${row.role_id}`;

    if (values["reset-2fa"]) {
      await tx`
        update admin_users set two_factor_method = null, totp_secret = null, totp_last_step = null
        where id = ${row.id}`;
      await tx`delete from admin_recovery_codes where admin_user_id = ${row.id}`;
    }
    await tx`delete from admin_sessions where admin_user_id = ${row.id}`;
    await tx`
      insert into admin_audit_events (action, target_label, details)
      values ('team.updated_from_cli', ${`${row.name} <${email}>`}, ${sql.json({
        created: !existing,
        role: roleName,
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
    return {
      ...row,
      roleName,
      created: !existing,
      purpose,
      link: `${siteUrl}/admin/${page}?token=${token}`,
    };
  });

  console.log(`${user.created ? "Added" : "Updated"} ${user.name} <${email}> as ${user.roleName}.`);
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

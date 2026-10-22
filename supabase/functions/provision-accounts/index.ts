// supabase/functions/provision-accounts/index.ts
// Creates personnel accounts end-to-end in one call, admin-only:
//   1. a generated LIB-#### library ID (the next free number),
//   2. a generated password (no look-alike characters),
//   3. the auth user + the usersData profile (role, position),
//   4. the credentials email sent from the library's Gmail to the person.
//
// send_email:false creates the accounts without sending any email and returns
// the generated passwords to the admin (for a later handover). The email is
// never stored by the function.
//
// An existing profile can be given a login by passing existing_library_id
// (for example the roster profile NTP-0006) instead of creating a duplicate
// LIB-#### record. The existing role/position/name are kept.
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";
import nodemailer from "nodemailer";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

function generatePassword(len = 12) {
  // no look-alike characters (0/O, 1/l/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

const norm = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");
const normKey = (s: unknown) =>
  norm(s).toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");

// The personnel form only offers these two new-account roles. An existing
// roster profile (existing_library_id) keeps its own role.
const ALLOWED_ROLES = ["staff", "librarian"];

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const gmailUser = Deno.env.get("GMAIL_USER")?.trim();
const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s/g, "");
const admin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null;
const mailer = gmailUser && gmailAppPassword
  ? nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    connectionTimeout: 10000,
    socketTimeout: 15000,
    auth: { user: gmailUser, pass: gmailAppPassword },
  })
  : null;

type CredentialsPerson = { first_name: string; email: string };

async function sendCredentials(
  person: CredentialsPerson,
  libraryId: string,
  password: string,
) {
  if (!mailer || !gmailUser) throw new Error("Email is not configured.");
  await mailer.sendMail({
    from: `"LIRC - City College of Calamba" <${gmailUser}>`,
    to: person.email,
    subject: "Your LIRC account details",
    text:
      `Hi ${person.first_name},\n\nYour LIRC account is ready.\n\n` +
      `Library ID: ${libraryId}\nEmail: ${person.email}\nPassword: ${password}\n\n` +
      `Log in at ${Deno.env.get("SITE_URL") ?? "the LIRC website"} with the email and password above.\n` +
      `Keep this email private and change your password after your first login.\n`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0B1330">
        <h2 style="margin:0 0 8px">Welcome, ${esc(person.first_name)}!</h2>
        <p>Your LIRC account is ready. Use these details to log in:</p>
        <table style="border:2px solid #0B1330;border-radius:12px;padding:16px;width:100%">
          <tr><td style="color:#555">Library ID</td>
              <td><b style="font-family:monospace;font-size:16px">${esc(libraryId)}</b></td></tr>
          <tr><td style="color:#555">Email</td><td><b>${esc(person.email)}</b></td></tr>
          <tr><td style="color:#555">Password</td>
              <td><b style="font-family:monospace;font-size:16px">${esc(password)}</b></td></tr>
        </table>
        <p style="margin-top:16px">
          <a href="${esc(Deno.env.get("SITE_URL") ?? "#")}"
             style="background:#0B1330;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">
             Go to LIRC</a>
        </p>
        <p style="color:#777;font-size:12px">Keep this email private. Change your password after your first login.</p>
      </div>`,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  if (!admin) {
    console.error("Provisioning services are not configured.");
    return json({ error: "Account provisioning is temporarily unavailable." }, 503);
  }

  // 1) the caller must be a signed-in admin
  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Sign in as an admin first." }, 401);
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who?.user) return json({ error: "Sign in as an admin first." }, 401);
  const { data: me, error: meErr } = await admin
    .from("usersData")
    .select("role")
    .eq("user_id", who.user.id)
    .maybeSingle();
  if (meErr) {
    console.error(meErr);
    return json({ error: "Couldn't check your access. Try again." }, 500);
  }
  if (!me || String(me.role).trim().toLowerCase() !== "admin") {
    return json({ error: "Admin access required." }, 403);
  }

  // 2) the people to provision
  let payload: unknown;
  try {
    const text = await req.text();
    if (text.length > 16384) return json({ error: "Request is too large." }, 413);
    payload = JSON.parse(text);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const payloadObj = (payload ?? {}) as Record<string, unknown>;
  const sendEmail = payloadObj.send_email !== false;
  if (sendEmail && !mailer) {
    console.error("Provisioning email is not configured.");
    return json({ error: "Account provisioning is temporarily unavailable." }, 503);
  }

  const people = payloadObj.people;
  if (!Array.isArray(people) || people.length === 0 || people.length > 20) {
    return json({ error: "Send between 1 and 20 people." }, 400);
  }

  const prepared: {
    first_name: string;
    middle_initial: string;
    surname: string;
    role: string;
    position: string;
    email: string;
    existing_library_id?: string;
  }[] = [];
  for (const item of people) {
    const row = (item ?? {}) as Record<string, unknown>;
    const first_name = norm(row.first_name);
    const middle_initial = norm(row.middle_initial).replace(/\./g, "");
    const surname = norm(row.surname);
    const role = norm(row.role).toLowerCase();
    const position = norm(row.position);
    const email = norm(row.email).toLowerCase();
    const existing_library_id = norm(row.existing_library_id).toUpperCase();
    if (!first_name || !surname || first_name.length > 100 || surname.length > 100) {
      return json({ error: "Every person needs a first name and a surname." }, 400);
    }
    if (middle_initial.length > 2) {
      return json({ error: `Check the middle initial of ${first_name} ${surname}.` }, 400);
    }
    if (!existing_library_id && !ALLOWED_ROLES.includes(role)) {
      return json(
        { error: `Role must be Staff or Librarian (${first_name} ${surname}).` },
        400,
      );
    }
    if (!/^[^\s@]+@ccc\.edu\.ph$/.test(email)) {
      return json(
        { error: `Use the school email ending in @ccc.edu.ph (${first_name} ${surname}).` },
        400,
      );
    }
    prepared.push({
      first_name,
      middle_initial,
      surname,
      role,
      position,
      email,
      existing_library_id: existing_library_id || undefined,
    });
  }

  // 3) resolve the position classification names (COS, Full Time, Part Time)
  const { data: positionRows, error: positionErr } = await admin
    .from("position_classifications")
    .select("id,name");
  if (positionErr) {
    console.error(positionErr);
    return json({ error: "Couldn't read the position list. Try again." }, 500);
  }
  const positionIds = new Map<string, number>(
    (positionRows ?? []).map((p) => [normKey(p.name), p.id as number]),
  );

  // 4) the next free LIB number
  const { data: libRows, error: libErr } = await admin
    .from("usersData")
    .select("library_id")
    .like("library_id", "LIB-%");
  if (libErr) {
    console.error(libErr);
    return json({ error: "Couldn't read the library ID list. Try again." }, 500);
  }
  const taken = new Set(
    (libRows ?? []).map((r) => String(r.library_id).trim().toUpperCase()),
  );
  let nextNumber = 1 + Math.max(
    0,
    ...(libRows ?? []).map((r) => {
      const match = /^LIB-(\d+)$/i.exec(String(r.library_id).trim());
      return match ? Number(match[1]) : 0;
    }),
  );

  // 5) provision one by one
  const results: {
    email: string;
    library_id?: string;
    role?: string;
    password?: string;
    ok: boolean;
    error?: string;
  }[] = [];

  for (const person of prepared) {
    let libraryId = "";
    try {
      // 5a) link a login to an existing roster profile (no duplicate row).
      if (person.existing_library_id) {
        const { data: existing, error: existingErr } = await admin
          .from("usersData")
          .select("library_id,first_name,middle_initial,surname,role,position_classification_id,user_id")
          .eq("library_id", person.existing_library_id)
          .maybeSingle();
        if (existingErr) throw new Error("Couldn't read the existing profile. Try again.");
        if (!existing) throw new Error(`Library ID ${person.existing_library_id} was not found.`);
        if (existing.user_id) throw new Error("That profile already has a login.");
        if (
          norm(existing.first_name).toLowerCase() !== person.first_name.toLowerCase() ||
          norm(existing.surname).toLowerCase() !== person.surname.toLowerCase()
        ) {
          throw new Error("That library ID belongs to a different person.");
        }

        const password = generatePassword();
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: person.email,
          password,
          email_confirm: true,
          user_metadata: {
            library_id: existing.library_id,
            first_name: existing.first_name,
            surname: existing.surname,
          },
        });
        if (createErr || !created.user) {
          const exists = /already|registered|exists/i.test(createErr?.message ?? "");
          throw new Error(
            exists
              ? "That email already has an account."
              : "Couldn't create the account. Please try again.",
          );
        }
        const authId = created.user.id;
        const { error: linkErr } = await admin
          .from("usersData")
          .update({ user_id: authId })
          .eq("library_id", existing.library_id);
        if (linkErr) {
          console.error(linkErr);
          await admin.auth.admin.deleteUser(authId);
          throw new Error("Couldn't link the profile. Please try again.");
        }

        if (sendEmail) {
          try {
            await sendCredentials(
              { first_name: existing.first_name, email: person.email },
              existing.library_id,
              password,
            );
          } catch (err) {
            console.error("Email failed:", err);
            await admin.from("usersData").update({ user_id: null }).eq("library_id", existing.library_id);
            await admin.auth.admin.deleteUser(authId);
            throw new Error("The email couldn't be sent, so nothing was saved. Try again.");
          }
        }

        results.push({
          email: person.email,
          library_id: existing.library_id,
          role: existing.role,
          ok: true,
          ...(sendEmail ? {} : { password }),
        });
        continue;
      }

      // 5b) create a new personnel account.
      do {
        libraryId = `LIB-${String(nextNumber).padStart(4, "0")}`;
        nextNumber += 1;
      } while (taken.has(libraryId));
      taken.add(libraryId);

      const positionId = person.position
        ? positionIds.get(normKey(person.position)) ?? null
        : null;
      if (person.position && positionId === null) {
        throw new Error(
          `Unknown position "${person.position}". Use COS, Full Time or Part Time.`,
        );
      }

      const password = generatePassword();
      const { data: created, error: createErr } = await admin.auth.admin
        .createUser({
          email: person.email,
          password,
          email_confirm: true, // they log in with the password right away
          user_metadata: {
            library_id: libraryId,
            first_name: person.first_name,
            surname: person.surname,
          },
        });
      if (createErr || !created.user) {
        const exists = /already|registered|exists/i.test(createErr?.message ?? "");
        throw new Error(
          exists
            ? "That email already has an account."
            : "Couldn't create the account. Please try again.",
        );
      }
      const authId = created.user.id;

      const { error: rowErr } = await admin.from("usersData").insert({
        library_id: libraryId,
        first_name: person.first_name,
        middle_initial: person.middle_initial || null,
        surname: person.surname,
        role: person.role,
        position_classification_id: positionId,
        user_id: authId,
      });
      if (rowErr) {
        console.error(rowErr);
        await admin.auth.admin.deleteUser(authId);
        throw new Error("Couldn't save the profile. Please try again.");
      }

      if (sendEmail) {
        try {
          await sendCredentials(
            { first_name: person.first_name, email: person.email },
            libraryId,
            password,
          );
        } catch (err) {
          console.error("Email failed:", err);
          // Roll back so the same person can simply be run again.
          await admin.from("usersData").delete().eq("library_id", libraryId);
          await admin.auth.admin.deleteUser(authId);
          throw new Error("The email couldn't be sent, so nothing was saved. Try again.");
        }
      }

      results.push({
        email: person.email,
        library_id: libraryId,
        role: person.role,
        ok: true,
        ...(sendEmail ? {} : { password }),
      });
    } catch (error) {
      results.push({
        email: person.email,
        ok: false,
        error: error instanceof Error ? error.message : "Couldn't create the account.",
      });
    }
  }

  return json({ ok: results.every((r) => r.ok), results });
});

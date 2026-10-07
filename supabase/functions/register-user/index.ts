// supabase/functions/register-user/index.ts
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";
import nodemailer from "nodemailer";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const norm = (s: unknown) =>
  String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const normInitial = (s: unknown) =>
  String(s ?? "").replace(/[.\s]/g, "").toLowerCase().slice(0, 1);

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

const gmailUser = Deno.env.get("GMAIL_USER")?.trim();
const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s/g, "");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

async function rollBackAccount(authId: string, cardId?: string | number) {
  if (!admin) return false;
  if (cardId !== undefined) {
    const { error } = await admin.from("usersData")
      .update({ user_id: null })
      .eq("id", cardId)
      .eq("user_id", authId);
    if (error) {
      console.error("Couldn't unlink the failed registration.", error);
      return false;
    }
  }
  const { error } = await admin.auth.admin.deleteUser(authId);
  if (error) console.error("Couldn't remove the failed registration.", error);
  return !error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  if (!mailer || !admin) {
    console.error("Registration services are not configured.");
    return json({ error: "Registration is temporarily unavailable. Please try again later." }, 503);
  }

  let payload: unknown;
  try {
    const text = await req.text();
    if (text.length > 4096) return json({ error: "Request is too large." }, 413);
    payload = JSON.parse(text);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return json({ error: "Invalid request." }, 400);
  }
  const body = payload as Record<string, unknown>;

  const fields = { first_name: 100, surname: 100, middle_initial: 2, library_id: 64, email: 254 };
  for (const [field, limit] of Object.entries(fields)) {
    const value = body[field] ?? "";
    if (typeof value !== "string" || value.length > limit) {
      return json({ error: "Please check your registration details." }, 400);
    }
  }

  const first_name = String(body.first_name ?? "").trim();
  const surname = String(body.surname ?? "").trim();
  const middle_initial = String(body.middle_initial ?? "").trim();
  const library_id = String(body.library_id ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();

  // 1) basic validation
  if (!first_name || !surname || !library_id || !email || !middle_initial) {
    return json({ error: "Please fill in all required fields." }, 400);
  }
  if (!/^[^\s@]+@ccc\.edu\.ph$/.test(email)) {
    return json({ error: "Use your school email ending in @ccc.edu.ph." }, 400);
  }

  // 2) find the library card
  const { data: row, error: rowErr } = await admin
    .from("usersData")
    .select("id, first_name, surname, middle_initial, library_id, user_id")
    .eq("library_id", library_id)
    .maybeSingle();

  if (rowErr) {
    console.error(rowErr);
    return json({ error: "Can't Find the Library Card please visit the Library" }, 500);
  }

  // Match the existing library record; the email comes from registration.
  // One message for all mismatches avoids revealing which details matched.
  const mismatch = {
    code: "record_mismatch",
    error:
      "We couldn't match those details to a library card. Check your first name, surname, middle initial, and library ID.",
  };
  if (!row) return json(mismatch, 404);
  if (
    norm(row.first_name) !== norm(first_name) ||
    norm(row.surname) !== norm(surname) ||
    normInitial(row.middle_initial) !== normInitial(middle_initial)
  ) {
    return json(mismatch, 404);
  }
  if (row.user_id) {
    return json(
      { error: "This library card already has an account. Try logging in." },
      409,
    );
  }

  // 3) create the auth user with a generated password
  const password = generatePassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // they log in with the emailed password right away
    user_metadata: {
      library_id: row.library_id,
      first_name: row.first_name,
      surname: row.surname,
    },
  });

  if (createErr || !created.user) {
    const taken = /already|registered|exists/i.test(createErr?.message ?? "");
    return json(
      {
        error: taken
          ? "That email already has an account. Try logging in."
          : "Couldn't create your account. Please try again.",
      },
      taken ? 409 : 500,
    );
  }
  const authId = created.user.id;

  // 4) link the auth user to the usersData row (only if still unlinked)
  const { data: linked, error: linkErr } = await admin
    .from("usersData")
    .update({ user_id: authId })
    .eq("id", row.id)
    .is("user_id", null)
    .select("id");

  if (linkErr || !linked?.length) {
    const cleanedUp = await rollBackAccount(authId);
    return json({ error: cleanedUp
      ? "Couldn't finish registration. Please try again."
      : "Couldn't finish registration. Please contact the LIRC library office for help." }, 500);
  }

  // 5) email the credentials
  try {
    await mailer.sendMail({
      from: `"LIRC – City College of Calamba" <${Deno.env.get("GMAIL_USER")}>`,
      to: email,
      subject: "Your LIRC account details",
      text:
        `Hi ${first_name},\n\nYour LIRC account is ready.\n\n` +
        `Email: ${email}\nPassword: ${password}\n\n` +
        `Log in at ${Deno.env.get("SITE_URL") ?? "the LIRC website"} using these details.\n`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0B1330">
          <h2 style="margin:0 0 8px">Welcome, ${esc(first_name)}!</h2>
          <p>Your LIRC account is ready. Use these details to log in:</p>
          <table style="border:2px solid #0B1330;border-radius:12px;padding:16px;width:100%">
            <tr><td style="color:#555">Email</td><td><b>${esc(email)}</b></td></tr>
            <tr><td style="color:#555">Password</td>
                <td><b style="font-family:monospace;font-size:16px">${esc(password)}</b></td></tr>
          </table>
          <p style="margin-top:16px">
            <a href="${esc(Deno.env.get("SITE_URL") ?? "#")}"
               style="background:#0B1330;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">
               Go to LIRC</a>
          </p>
          <p style="color:#777;font-size:12px">Keep this email private. If you didn't register, ignore it and tell the library staff.</p>
        </div>`,
    });
  } catch (err) {
    console.error("Email failed:", err);
    // roll back so the student can try again
    const cleanedUp = await rollBackAccount(authId, row.id);
    return json(
      { error: cleanedUp
        ? "We couldn't send the email. Please try again later."
        : "We couldn't finish registration. Please contact the LIRC library office for help." },
      502,
    );
  }

  return json({ ok: true });
});

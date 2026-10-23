// supabase/functions/request-password-reset/index.ts
//
// Sends the "Choose a new password" email. This endpoint is public because
// the visitor is signed OUT when they use it. It is written defensively:
//   1. Every email address gets the same generic reply, whether or not an
//      account exists. Strangers cannot discover who has an account.
//   2. The same address cannot be emailed more than once every
//      RESEND_COOLDOWN_SECONDS (tracked in public.password_reset_requests).
//   3. The emailed link carries a single-use recovery token created by
//      Supabase Auth. This function never stores or logs the token, and it
//      expires on its own.
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";
import nodemailer from "nodemailer";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// The one and only reply for every email that passes basic checks.
const genericReply = { ok: true };

const RESEND_COOLDOWN_SECONDS = 120;

// Same SMTP account as the other LIRC account emails; values come from secrets.
const gmailUser = Deno.env.get("GMAIL_USER")?.trim();
const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s/g, "");
// The website address used inside the emailed link.
const siteUrl = (Deno.env.get("SITE_URL") ?? "").trim().replace(/\/+$/, "");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const admin =
  supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const mailer =
  gmailUser && gmailAppPassword
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        connectionTimeout: 10000,
        socketTimeout: 15000,
        auth: { user: gmailUser, pass: gmailAppPassword },
      })
    : null;

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

// True when this address asked for a reset very recently.
async function recentlyRequested(email: string) {
  const { data } = await admin!
    .from("password_reset_requests")
    .select("requested_at")
    .eq("email", email)
    .maybeSingle();
  if (!data?.requested_at) return false;
  return Date.now() - Date.parse(data.requested_at) < RESEND_COOLDOWN_SECONDS * 1000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  if (!mailer || !admin || !siteUrl) {
    // Same answer for everyone, so this reveals nothing about accounts.
    console.error("Password reset is not configured (mailer/admin/SITE_URL).");
    return json(
      { error: "Password reset is temporarily unavailable. Please try again later." },
      503,
    );
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

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please check your email address." }, 400);
  }

  // Asked too recently: skip quietly, reply stays identical.
  if (await recentlyRequested(email)) return json(genericReply);

  // Ask Supabase Auth for a one-time recovery token. Unknown emails fail
  // here, and the caller still gets the same generic reply.
  let link = "";
  let firstName = "";
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (error || !data?.properties?.hashed_token) {
      console.error("generateLink failed:", error?.message);
      return json(genericReply);
    }
    const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
    firstName = typeof meta.first_name === "string" ? meta.first_name : "";
    link =
      `${siteUrl}/reset-password` +
      `?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
  } catch (err) {
    console.error("generateLink failed:", err);
    return json(genericReply);
  }

  // Claim the cooldown before sending so fast repeat clicks cannot send twice.
  await admin
    .from("password_reset_requests")
    .upsert({ email, requested_at: new Date().toISOString() });

  try {
    await mailer.sendMail({
      from: `"LIRC – City College of Calamba" <${gmailUser}>`,
      to: email,
      subject: "Choose a new LIRC password",
      text:
        `Hi${firstName ? ` ${firstName}` : ""},\n\n` +
        `We received a request to change your LIRC password.\n` +
        `Open this link to choose a new one:\n${link}\n\n` +
        `The link can be used once and expires after a short time.\n` +
        `If you didn't ask for this, you can ignore this email — your password stays the same.\n`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0B1330">
          <h2 style="margin:0 0 8px">Choose a new password</h2>
          <p>Hi${firstName ? ` ${esc(firstName)}` : ""},</p>
          <p>We received a request to change your LIRC password. Click the button below to pick a new one:</p>
          <p style="margin:20px 0">
            <a href="${esc(link)}"
               style="background:#0B1330;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">
               Choose a new password</a>
          </p>
          <p style="color:#777;font-size:12px">Or paste this link into your browser:<br>
            <span style="word-break:break-all">${esc(link)}</span></p>
          <p style="color:#777;font-size:12px">The link can be used once and expires after a short time.
            If you didn't ask for a password change, you can ignore this email — your password stays the same.</p>
          <p style="color:#777;font-size:12px">For your safety, LIRC staff will never ask you for your password.</p>
        </div>`,
    });
  } catch (err) {
    // Logged for staff; the visitor can request again after the cooldown.
    console.error("Reset email failed:", err);
  }

  return json(genericReply);
});

// Monthly AI performance summary for one library staff member.
//
// Auth: an admin's user token (the page's Generate button) or the monthly
// cron calling with x-cron-secret. The Gemini key lives only here, server
// side. The function gathers the month dossier (aggregates, quality signals,
// sampled log sentences), asks Gemini for a structured judgement, maps the
// score to the fixed rating scale and upserts one row per person per month.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATING_SCALE = [
  [90, "Excellent"],
  [80, "Very good"],
  [70, "Good"],
  [60, "Satisfactory"],
  [45, "Needs improvement"],
  [0, "Unsatisfactory"],
];

export function ratingLabel(score) {
  for (const [min, label] of RATING_SCALE) if (score >= min) return label;
  return "Unsatisfactory";
}

const SYSTEM_PROMPT = [
  "You are the performance analyst for the Learning and Information Resource Center (LIRC) of City College of Calamba, a Philippine academic library.",
  "Each month you receive ONE library staff member's activity log from the library system: aggregate numbers, quality signals and a sample of the actual recorded actions in plain words.",
  "Your job: judge the QUALITY and SUBSTANCE of the recorded work and write a fair, evidence-based summary for the library administrator.",
  "",
  "Scoring (0-100). You return only the number; the rating level is applied by the system:",
  "90-100 Excellent | 80-89 Very good | 70-79 Good | 60-69 Satisfactory | 45-59 Needs improvement | 0-44 Unsatisfactory",
  "",
  "How to judge — the QUALITY of work only:",
  "1. Do NOT judge how many days they worked or when they were active. Off-duty days, holidays and school circumstances are normal — real work done on only a few days is fine. Judge only the quality and substance of the work that IS recorded.",
  "2. Routine actions are NEUTRAL: recording student time in and out, approving or rejecting a request, standard scans — doing them is part of the job. They do not by themselves raise the score, and they are not judged one by one.",
  "3. Substantive work RAISES the score: real data processed with care — validations completed with correct records, catalog records added or edited properly, inventory sessions with many distinct copies checked, member records handled, loans processed. Cite the concrete evidence from the sample.",
  "4. Spam pattern LOWERS the score: many actions of the same trivial kind, actions repeated in very short bursts (use the max_actions_in_5_min signal and the sample timestamps), or actions that exist only to raise the numbers. A high max_single_action_share (above about 0.7) or a large max_actions_in_5_min on routine actions means padding — score it LOW and say plainly what looked like spam.",
  "5. Unusual activity with a hidden motive must be MENTIONED explicitly in concerns: repeatedly toggling or re-editing the same record, bursts with no substance, patterns that look like dashboard padding, or anything else that does not look like genuine library work.",
  "",
  "Compare with their own standard:",
  "- The history array holds this person's previous monthly ratings (month, score, level, headline, and the same key numbers). Use it as the baseline: state clearly whether this month did MORE or LESS than their usual, whether the quality improved or declined, and whether the work became more efficient (better substance with similar or fewer actions) or thinner.",
  "- Compare the actual numbers, not only the scores. If there is no history, say this is the first recorded month and judge it on its own.",
  "- Set trend to First month when there is no history, otherwise Improved / Steady / Declined compared with their previous months.",
  "",
  "Rules:",
  "- Base every statement ONLY on the provided data. Never invent events, numbers or people. When the sample is thin, say the month is thin and score conservatively.",
  "- If almost no actions were recorded, say so plainly and score low; do not fill space.",
  "- Be fair and professional; describe behavior, not personality. Concerns are constructive, never insults.",
  "- Cite a few concrete example actions from the sample, with their times, as evidence.",
  "- Write in English, plain sentences, no markdown, no emojis.",
].join("\n");

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    headline: { type: "string" },
    trend: {
      type: "string",
      enum: ["First month", "Improved", "Steady", "Declined"],
    },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    concerns: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
  },
  required: [
    "score",
    "headline",
    "trend",
    "summary",
    "strengths",
    "concerns",
    "recommendations",
  ],
  propertyOrdering: [
    "score",
    "headline",
    "trend",
    "summary",
    "strengths",
    "concerns",
    "recommendations",
  ],
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function strings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503]);

async function requestGemini(model, apiKey, dossier) {
  return await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(dossier) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  );
}

// The free tier sometimes answers 503 ("high demand") — retry the primary
// model a few times, then walk the fallback list. Only transient statuses
// are retried; a real error (bad key, bad request) stops immediately.
async function generateJudgement(apiKey, primary, fallbacks, dossier) {
  const models = [primary, ...fallbacks.filter((model) => model !== primary)];
  let lastError = "";
  for (const model of models) {
    const attempts = model === primary ? 3 : 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const response = await requestGemini(model, apiKey, dossier);
      if (response.ok) {
        const payload = await response.json();
        const text =
          payload?.candidates?.[0]?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("") ?? "";
        return { text, model };
      }
      lastError = `${model} (${response.status}): ${(await response.text()).slice(0, 200)}`;
      if (!RETRYABLE_STATUS.has(response.status)) {
        return { error: lastError, retryable: false };
      }
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
      }
    }
  }
  return { error: lastError, retryable: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // Auth: the monthly cron secret, or a signed-in admin's token.
    const cronSecret = req.headers.get("x-cron-secret");
    const isCron =
      Boolean(cronSecret) && cronSecret === Deno.env.get("CRON_SECRET");
    let generatedBy = null;
    if (!isCron) {
      const token = (req.headers.get("Authorization") ?? "").replace(
        /^Bearer\s+/i,
        "",
      );
      if (!token) return json({ error: "Sign in first." }, 401);
      const { data: authData, error: authError } = await supabase.auth.getUser(
        token,
      );
      if (authError || !authData?.user) return json({ error: "Sign in first." }, 401);
      const { data: me } = await supabase
        .from("usersData")
        .select("id, role")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (!me || me.role !== "admin")
        return json({ error: "Admin access required." }, 403);
      generatedBy = me.id;
    }

    const body = await req.json().catch(() => null);
    const profileId = Number(body?.profileId);
    const month = String(body?.month ?? "");
    if (!Number.isInteger(profileId) || profileId <= 0)
      return json({ error: "Choose a person." }, 400);
    if (!/^\d{4}-\d{2}$/.test(month))
      return json({ error: "Choose a month." }, 400);

    const { data: dossier, error: dossierError } = await supabase.rpc(
      "lirc_performance_ai_input",
      { p_profile_id: profileId, p_month: `${month}-01` },
    );
    if (dossierError) return json({ error: dossierError.message }, 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "The AI key is not configured yet." }, 500);
    const primary = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
    const fallbacks = (
      Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "gemini-flash-lite-latest"
    )
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);

    const judgement = await generateJudgement(
      apiKey,
      primary,
      fallbacks,
      dossier,
    );
    if (judgement.error) {
      return json(
        {
          error: judgement.retryable
            ? "The AI is busy right now (Google's side). Please try again in a minute."
            : `The AI request failed — ${judgement.error}`,
        },
        502,
      );
    }
    const model = judgement.model;
    let result;
    try {
      result = JSON.parse(judgement.text);
    } catch {
      return json({ error: "The AI returned an unreadable answer. Try again." }, 502);
    }

    const score = Math.max(0, Math.min(100, Math.round(Number(result?.score ?? 0) || 0)));
    const label = ratingLabel(score);

    const { data: saved, error: saveError } = await supabase
      .from("performance_reports")
      .upsert(
        {
          user_profile_id: profileId,
          period_month: `${month}-01`,
          rating_score: score,
          rating_label: label,
          headline: String(result?.headline ?? "").slice(0, 500),
          summary: {
            summary: String(result?.summary ?? ""),
            trend: String(result?.trend ?? "").slice(0, 40),
            strengths: strings(result?.strengths),
            concerns: strings(result?.concerns),
            recommendations: strings(result?.recommendations),
            stats: dossier?.totals ?? null,
            signals: dossier?.signals ?? null,
            by_kind: dossier?.by_kind ?? [],
          },
          model,
          generated_by: generatedBy,
        },
        { onConflict: "user_profile_id,period_month" },
      )
      .select()
      .single();
    if (saveError) return json({ error: saveError.message }, 500);

    return json({ ok: true, report: saved });
  } catch (error) {
    return json({ error: error?.message ?? "Unexpected error." }, 500);
  }
});

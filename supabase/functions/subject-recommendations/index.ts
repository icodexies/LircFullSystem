// AI book recommendations for one curriculum subject (course code).
//
// Auth: a signed-in librarian's or admin's token (the Path Finder modal's
// "AI recommendation" button). The Gemini key lives only here, server side.
// The function gathers the subject context (title, programs, current
// recommendations, recent candidate books published within the last five
// years — the CHED rule), asks Gemini WITH Google Search grounding for
// reliable sources, validates the picks against the real catalog, stores one
// finding row (subject_ai_findings) and returns it. Stored findings are what
// the modal previews — tokens are only spent on an explicit search.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// CHED CMO 22 s.2021: five relevant titles per major subject, published
// within the last five years. Candidates are limited to that window.
const RECENT_YEARS = 5;
const CANDIDATE_LIMIT = 60;
const MAX_PICKS = 6;
const MAX_ACQUISITIONS = 8;
const MAX_CITATIONS = 12;

const SYSTEM_PROMPT = [
  "You are the collection development assistant for the Learning and Information Resource Center (LIRC) of City College of Calamba, a Philippine academic library.",
  "You receive ONE curriculum subject: its code and title, the programs it is taught in, the books the library already recommends for it, and a candidate list of recent books the library owns (published within the last five years, per CHED CMO 22 s.2021).",
  "",
  "Your job, in two parts:",
  "1. PICKS — choose which of the candidate books genuinely support this subject. Use ONLY candidates by their book_id. Prefer 3 to 6 strong picks; fewer is fine when the list is weak. Give each a one-sentence reason tied to the subject's topics.",
  "2. ACQUISITIONS — recommend authoritative books the library does NOT own that should be acquired for this subject. Search the web for reliable sources (publishers, universities, professional bodies, standard reading lists) and prefer editions published within the last five years. For each: title, author, publisher, year, a one-sentence reason, and the source URL you relied on.",
  "",
  "Rules:",
  "- Only use candidate book_ids that exist in the list; never invent library books.",
  "- For acquisitions, use only real, verifiable books from reputable sources. Never invent titles, authors or URLs.",
  "- Prefer sources from publishers, universities, government or professional associations; avoid blogs, marketplaces and content farms.",
  "- If the candidate list is small or off-topic, say so plainly in the summary and lean on acquisitions.",
  "- Answer with ONE JSON object only, no markdown, no extra text:",
  '{"summary": "one short paragraph about this subject\'s reading needs", "picks": [{"book_id": 123, "reason": "..."}], "acquisitions": [{"title": "...", "author": "...", "publisher": "...", "year": 2023, "reason": "...", "source": "https://..."}]}',
].join("\n");

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    picks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          book_id: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["book_id", "reason"],
      },
    },
    acquisitions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          publisher: { type: "string" },
          year: { type: "integer" },
          reason: { type: "string" },
          source: { type: "string" },
        },
        required: ["title", "reason"],
      },
    },
  },
  required: ["summary", "picks", "acquisitions"],
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503]);
const TOOL_HINT = /tool|grounding|google_search|google search/i;

async function callGemini({ apiKey, model, dossier, web, schema }) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify(dossier) }] }],
    generationConfig: schema
      ? { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema }
      : { temperature: 0.2 },
  };
  if (web) body.tools = [{ google_search: {} }];
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail: `${model} (${response.status}): ${(await response.text()).slice(0, 200)}`,
    };
  }
  const payload = await response.json();
  const candidate = payload?.candidates?.[0];
  const text =
    candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return { ok: true, text, grounding: candidate?.groundingMetadata ?? null };
}

// Web first — on the grounding-capable model (2.5 Flash works on the free
// tier; the newer models often cannot ground there). When the web attempt
// fails, the rest of the run continues catalog-only across the model chain
// (and the stored row says so). Transient failures retry, like the
// performance summary function.
async function generateFindings({ apiKey, models, webModel, dossier }) {
  let lastError = "";

  // 1) Web-grounded attempt(s).
  let webError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const withWeb = await callGemini({ apiKey, model: webModel, dossier, web: true });
    if (withWeb.ok) return { ...withWeb, model: webModel, web: true };
    lastError = withWeb.detail;
    webError = withWeb.detail.slice(0, 300);
    const worthRetrying =
      RETRYABLE_STATUS.has(withWeb.status) && !TOOL_HINT.test(withWeb.detail);
    if (!worthRetrying) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  // 2) Catalog-only across the chain.
  for (const model of models) {
    const attempts = model === models[0] ? 2 : 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const noWeb = await callGemini({
        apiKey,
        model,
        dossier,
        web: false,
        schema: RESPONSE_SCHEMA,
      });
      if (noWeb.ok) return { ...noWeb, model, web: false, webError };
      lastError = noWeb.detail;
      if (!RETRYABLE_STATUS.has(noWeb.status)) {
        return { error: lastError, retryable: false };
      }
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
      }
    }
  }
  return { error: lastError, retryable: true };
}

// The model may wrap JSON in fences or add a sentence; keep the JSON block.
function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function cleanText(value, limit) {
  return String(value ?? "").trim().slice(0, limit);
}

function httpUrl(value) {
  const text = String(value ?? "").trim();
  return /^https?:\/\//i.test(text) ? text.slice(0, 500) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // Auth: a signed-in librarian or admin.
    const token = (req.headers.get("Authorization") ?? "").replace(
      /^Bearer\s+/i,
      "",
    );
    if (!token) return json({ error: "Sign in first." }, 401);
    const { data: authData, error: authError } = await supabase.auth.getUser(
      token,
    );
    if (authError || !authData?.user)
      return json({ error: "Sign in first." }, 401);
    const { data: me } = await supabase
      .from("usersData")
      .select("id, role")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (!me || !["librarian", "admin"].includes(String(me.role).toLowerCase()))
      return json({ error: "Librarian or admin access required." }, 403);

    const body = await req.json().catch(() => null);
    const courseCode = cleanText(body?.course_code, 40).toUpperCase();
    if (!courseCode) return json({ error: "Choose a subject." }, 400);

    // ------------------------------------------------------------------
    // The subject dossier (service role reads; bounded queries only).
    // ------------------------------------------------------------------
    const { data: subjects } = await supabase
      .from("curriculum_subjects")
      .select("id, course_code, course_title")
      .ilike("course_code", courseCode)
      .limit(1);
    const subject = subjects?.[0];
    if (!subject)
      return json({ error: "Subject not found in the curriculum." }, 400);

    const { data: entries } = await supabase
      .from("curriculum_entries")
      .select("year_level, semester, curriculum_programs(code)")
      .eq("subject_id", subject.id);
    const programs = [
      ...new Set(
        (entries ?? [])
          .map((entry) => entry.curriculum_programs?.code)
          .filter(Boolean),
      ),
    ];

    // What the library already recommends for this subject.
    const { data: current } = await supabase
      .from("subject_recommendations")
      .select("book_id, books(book_name, author, publish_year)")
      .eq("course_code", courseCode)
      .eq("status", "approved");
    const currentBooks = (current ?? [])
      .map((row) => row.books)
      .filter(Boolean)
      .map((book) => ({
        title: book.book_name,
        author: book.author,
        year: book.publish_year,
      }));

    // Candidates: recent books (CHED window) matching the subject's words.
    const stopWords = new Set([
      "and", "the", "of", "for", "with", "introduction", "fundamentals",
      "principles", "basic", "basics", "advanced", "i", "ii", "1", "2",
    ]);
    const words = String(subject.course_title ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !stopWords.has(word))
      .slice(0, 6);
    const minYear = new Date().getFullYear() - RECENT_YEARS;

    let candidates = [];
    if (words.length > 0) {
      const orFilter = words
        .flatMap((word) => [
          `book_name.ilike.%${word}%`,
          `author.ilike.%${word}%`,
        ])
        .join(",");
      const { data: books } = await supabase
        .from("books")
        .select("id, book_name, author, publish_year, call_number")
        .gte("publish_year", minYear)
        .or(orFilter)
        .limit(CANDIDATE_LIMIT);
      candidates = books ?? [];
    }

    const dossier = {
      subject: {
        course_code: subject.course_code,
        course_title: subject.course_title,
        taught_in_programs: programs,
      },
      rule: `Recommend library picks only from books published ${minYear} or later (CHED: within the last five years).`,
      current_recommendations: currentBooks,
      candidate_books: candidates.map((book) => ({
        book_id: book.id,
        title: book.book_name,
        author: book.author,
        year: book.publish_year,
        call_number: book.call_number,
      })),
    };

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "The AI key is not configured yet." }, 500);
    const webModel = Deno.env.get("GEMINI_WEB_MODEL") ?? "gemini-3.8-flash";
    const primary = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
    const fallbacks = (
      Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "gemini-flash-lite-latest"
    )
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);

    const result = await generateFindings({
      apiKey,
      webModel,
      models: [primary, ...fallbacks.filter((model) => model !== primary)],
      dossier,
    });
    if (result.error) {
      return json(
        {
          error: result.retryable
            ? "The AI is busy right now (Google's side). Please try again in a minute."
            : `The AI request failed — ${result.error}`,
        },
        502,
      );
    }

    const parsed = parseJson(result.text);
    if (!parsed || typeof parsed !== "object")
      return json({ error: "The AI returned an unreadable answer. Try again." }, 502);

    // Validate the picks against the real candidate list.
    const byId = new Map(candidates.map((book) => [book.id, book]));
    const picks = (Array.isArray(parsed.picks) ? parsed.picks : [])
      .map((pick) => {
        const book = byId.get(Number(pick?.book_id));
        if (!book) return null;
        return {
          book_id: book.id,
          book_name: book.book_name,
          author: book.author,
          publish_year: book.publish_year,
          reason: cleanText(pick?.reason, 400),
        };
      })
      .filter(Boolean)
      .slice(0, MAX_PICKS);

    const acquisitions = (Array.isArray(parsed.acquisitions)
      ? parsed.acquisitions
      : []
    )
      .map((item) => ({
        title: cleanText(item?.title, 200),
        author: cleanText(item?.author, 200) || null,
        publisher: cleanText(item?.publisher, 120) || null,
        year: Number.isInteger(Number(item?.year))
          ? Number(item.year)
          : null,
        reason: cleanText(item?.reason, 400),
        source: httpUrl(item?.source),
      }))
      .filter((item) => item.title && item.reason)
      .slice(0, MAX_ACQUISITIONS);

    const seen = new Set();
    const citations = [];
    for (const chunk of result.grounding?.groundingChunks ?? []) {
      const uri = httpUrl(chunk?.web?.uri);
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      citations.push({ title: cleanText(chunk?.web?.title, 200) || uri, url: uri });
      if (citations.length >= MAX_CITATIONS) break;
    }

    const findings = {
      summary: cleanText(parsed.summary, 1200),
      picks,
      acquisitions,
      candidate_count: candidates.length,
      web_error: result.webError || null,
    };

    const { data: saved, error: saveError } = await supabase
      .from("subject_ai_findings")
      .insert({
        course_code: subject.course_code,
        model: result.model,
        web: Boolean(result.web),
        findings,
        citations,
        generated_by: me.id,
      })
      .select()
      .single();
    if (saveError) return json({ error: saveError.message }, 500);

    return json({ ok: true, finding: saved });
  } catch (error) {
    return json({ error: error?.message ?? "Unexpected error." }, 500);
  }
});

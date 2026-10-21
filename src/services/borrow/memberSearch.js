// Ranking for the member search used by the borrow lookup.
//
// The database lookup already finds every word in any order (so "Reyes Maria"
// and "D. Villanueva" work) and falls back to similar names for a typo in the
// whole query. This module adds two things on top of the rows it returns:
//
//   1. Relevance — an exact word (e.g. the middle initial "D.") beats a name
//      that merely contains the letter, so "d villanueva" puts Sam D.
//      Villanueva first instead of whoever comes first by surname.
//   2. Per-word typo tolerance — "sma villanueba" scores each word against the
//      name tokens (Sam / Villanueva) instead of the whole query at once.
//
// Plain JavaScript with no Supabase import so it can be unit tested.

// Lowercase, no accents. Punctuation is handled per use below.
function base(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// The words a person typed: commas/periods become spaces ("Villanueva, D." →
// ["villanueva", "d"]), so a middle initial is compared like any other token.
export function searchWords(query) {
  return base(query)
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function nameTokens(fullName) {
  return base(fullName).replace(/[.,]/g, " ").split(/\s+/).filter(Boolean);
}

// Cards compare without hyphens or spaces so "2600001" finds "26-00001".
function cardKey(value) {
  return base(value).replace(/[^a-z0-9]/g, "");
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Damerau-Levenshtein (adjacent swaps cost one edit) so "sma" still reads
  // as "sam" and "vilanueva" as "villanueva".
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid = Array.from({ length: rows }, (_, row) => {
    const cells = new Array(cols).fill(0);
    cells[0] = row;
    return cells;
  });
  for (let column = 1; column < cols; column += 1) grid[0][column] = column;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      grid[i][j] = Math.min(
        grid[i - 1][j] + 1,
        grid[i][j - 1] + 1,
        grid[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        grid[i][j] = Math.min(grid[i][j], grid[i - 2][j - 2] + 1);
      }
    }
  }
  return grid[a.length][b.length];
}

function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 0 : 1 - editDistance(a, b) / longest;
}

// Best score for one typed word against a member row. 1 = exact token,
// 0.94 = starts with it, 0.86 = contains it, otherwise the typo similarity.
function wordScore(word, tokens, card) {
  let best = 0;
  for (const token of tokens) {
    if (token === word) return 1;
    if (token.startsWith(word)) best = Math.max(best, 0.94);
    else if (token.includes(word)) best = Math.max(best, 0.86);
    else {
      const score = similarity(word, token);
      if (score >= 0.55) best = Math.max(best, score);
    }
  }
  const key = word.replace(/[^a-z0-9]/g, "");
  if (card && key.length >= 2) {
    if (card === key) return 1.1;
    if (card.startsWith(key)) best = Math.max(best, 0.96);
    else if (card.includes(key)) best = Math.max(best, 0.9);
  }
  return best;
}

// Every typed word has to match something on the member — the weakest word
// decides, so one unrelated word drops the row instead of matching anything.
export function scoreMember(row, words) {
  if (!words.length) return 0;
  const tokens = nameTokens(row.full_name);
  const card = cardKey(row.library_id);
  let lowest = Infinity;
  for (const word of words) {
    lowest = Math.min(lowest, wordScore(word, tokens, card));
  }
  return lowest;
}

function byName(a, b) {
  const surnameA = nameTokens(a.full_name)[0] ?? "";
  const surnameB = nameTokens(b.full_name)[0] ?? "";
  return (
    surnameA.localeCompare(surnameB) ||
    String(a.id ?? "").localeCompare(String(b.id ?? ""), undefined, {
      numeric: true,
    })
  );
}

// Best match first. `minScore` filters the per-word fallback ("sma" must still
// look like "sam"); the database's own matches are kept regardless.
export function rankMembers(rows, query, { minScore = 0 } = {}) {
  const words = searchWords(query);
  if (!words.length) return rows;
  return rows
    .map((row) => ({ row, score: scoreMember(row, words) }))
    .filter((entry) => entry.score > 0 && entry.score >= minScore)
    .sort((a, b) => b.score - a.score || byName(a.row, b.row))
    .map((entry) => entry.row);
}

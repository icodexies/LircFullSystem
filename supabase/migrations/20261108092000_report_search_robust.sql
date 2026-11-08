-- ============================================================================
-- Robust search for the validation and attendance reports.
--
-- The old predicate split the query on whitespace but compared each raw
-- fragment with strpos() against the raw profile fields. That made these fail:
--   "Villanueva, Sam D."   (comma)
--   "sam d."               (period in the middle initial)
--   "2600001"              (card stored as 26-00001)
--
-- This version normalizes punctuation to spaces, matches every query word
-- against a word-start/name token, and compares the library card with
-- punctuation removed. It also lets the default Full name search find a card,
-- like the optimized member lookup used by the Users page.
-- ============================================================================
begin;

create or replace function lirc_private.report_search(p jsonb, f jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
with input as (
  select
    btrim(coalesce(f->>'search', '')) as raw_search,
    left(btrim(coalesce(f->>'search', '')), 120) as short_search,
    coalesce(nullif(f->>'search_by', ''), 'full_name') as search_by
),
field as (
  select
    input.*,
    case input.search_by
      when 'library_id' then coalesce(p->>'library_id', '')
      when 'first_name' then coalesce(p->>'first_name', '')
      when 'surname' then coalesce(p->>'surname', '')
      when 'middle_initial' then coalesce(p->>'middle_initial', '')
      when 'suffix' then coalesce(p->>'suffix', '')
      else concat_ws(
        ' ',
        p->>'first_name',
        p->>'middle_initial',
        p->>'surname',
        p->>'suffix'
      )
    end as field_text
  from input
),
prepared as (
  select
    field.*,
    lower(regexp_replace(field_text, '[^a-zA-Z0-9]+', ' ', 'g')) as norm_text,
    regexp_replace(lower(field_text), '[^a-z0-9]+', '', 'g') as compact_text,
    regexp_replace(lower(short_search), '[^a-z0-9]+', '', 'g') as compact_query,
    regexp_replace(
      lower(coalesce(p->>'library_id', '')),
      '[^a-z0-9]+',
      '',
      'g'
    ) as compact_card
  from field
),
words as (
  select regexp_split_to_table(
    lower(regexp_replace(short_search, '[^a-zA-Z0-9]+', ' ', 'g')),
    '\s+'
  ) as word
  from prepared
  where btrim(regexp_replace(short_search, '[^a-zA-Z0-9]+', ' ', 'g')) <> ''
),
checked as (
  select
    prepared.*,
    exists (select 1 from words where btrim(word) <> '') as has_words,
    not exists (
      select 1
      from words w
      where btrim(w.word) <> ''
        and not exists (
          select 1
          from regexp_split_to_table(prepared.norm_text, '\s+') token
          where btrim(token) <> ''
            and (
              token like lower(w.word) || '%'
              or (char_length(w.word) >= 3 and token like '%' || lower(w.word) || '%')
            )
        )
    ) as every_word_matches
  from prepared
)
select case
  when raw_search = '' then true
  else
    (
      compact_query <> ''
      and (
        (
          search_by = 'library_id'
          and strpos(compact_text, compact_query) > 0
        )
        or (
          search_by <> 'library_id'
          and char_length(compact_query) >= 3
          and strpos(compact_text, compact_query) > 0
        )
        or (
          search_by = 'full_name'
          and char_length(compact_query) >= 2
          and strpos(compact_card, compact_query) > 0
        )
      )
    )
    or (has_words and every_word_matches)
  end
from checked;
$$;

revoke all on function lirc_private.report_search(jsonb, jsonb)
  from public, anon, authenticated;

commit;

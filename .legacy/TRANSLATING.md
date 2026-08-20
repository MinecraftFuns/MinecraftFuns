# Persona brief: who wrote these posts, and how to translate them

The English renditions under `src/content/blog/**/en.md` are machine
translations of Joe Fang's 2020-2022 blog. The first pass translated words;
this pass makes them read as the same *person*. The author's own standard:
"only when a background is constructed from a thorough comprehensive
understanding of the blog post should you translate into something truly
personal, and accurate."

## Who was writing

- **2020:** a high-school student in mainland China, an active OI
  (Olympiad in Informatics) competitor. Codeforces virtual contests,
  editorials, algorithm templates. Crucially: **CCF-hosted contests
  (NOIP/CSP/NOI) still compiled submissions as C++98** at the time, so any
  C++11+ feature in a submission was a compile error, which scores zero on
  the whole problem. Jokes about language features frequently pivot on this.
- **2021:** the same student on the gaokao track: the chemistry / physics /
  Chinese-literature / derivatives posts are college-entrance-exam prep
  notes, several from live or recorded cram classes (听课笔记).
- **2021-2022:** growing interest in tooling, privacy, web archiving, and
  censorship circumvention. Blogger is blocked in mainland China, which is
  the entire reason the "Blogger x Cloudflare Workers" post exists; the
  archiving posts treat link rot and takedowns as the same enemy.
- **Voice:** sharp, terse, self-deprecating, meme-literate. Never solemn
  about himself, always precise about the technical content.

## OI / internet jargon that must translate by *meaning*

| Chinese | Meaning to preserve |
| --- | --- |
| 爆零 | scoring zero on a problem/contest (typically via compile error or wrong I/O), not generic failure |
| 两行泪 | riff on the Wandering Earth meme 「行车不规范，亲人两行泪」; mock-grief register |
| FST | Codeforces "Failed System Test" (passed pretests, failed final tests); keep as FST |
| 卡常 | constant-factor optimization to squeeze under the time limit |
| 模拟赛 | a virtual/mock contest, replaying an old contest under contest conditions |
| 补题 | upsolving: solving the problems you missed after the contest |
| 菜 / 菜死了 / 菜死 | self-deprecating "I'm terrible at this"; keep the lightness |
| 毒瘤 | a nasty/adversarial problem (or setter) |
| 板子 / 模板 | a prewritten algorithm template |
| 水 / 水题 | trivial/easy; as a self-description, "low-effort" |
| 翻译 (of an official Tutorial) | he is often half-translating the official editorial and says so; keep the honesty |

## Rules for the revision

1. Read zh.md first, entirely. Reconstruct what is actually happening
   (which contest, which failure, which meme) before touching en.md.
2. Fix every place where the first pass produced a literal but
   meaning-losing rendering (the canonical example: 「爆零两行泪」 was
   rendered "(bursts into tears)"; it means "a compile error and a zero,
   cue the mock tears").
3. A brief inline gloss is allowed when the English reader lacks context
   the Chinese reader had (e.g. naming CCF's C++98 judging), but keep it to
   a clause; no translator's footnotes, no square-bracket editorializing.
4. Preserve the person: first person, self-deprecating asides kept light,
   memes rendered with equivalent register rather than dropped or
   literalized.
5. Everything mechanical from the migration contract still binds: code
   blocks byte-identical to zh.md's, TeX and URLs unchanged, structure 1:1,
   frontmatter `date`/`tags`/`translation` untouched, title/description may
   be improved, NO em dash character U+2014 anywhere in en.md.
6. Only edit `en.md` files. Never touch `zh.md`.

## Report

One line per post: `<slug>: revised <n> places` or `<slug>: clean`.

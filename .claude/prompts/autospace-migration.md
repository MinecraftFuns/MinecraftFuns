# Task: remove manual inter-script spaces from the blog archive

You are editing a static site repository. Your entire job is to delete certain
space characters from Markdown files. Nothing else.

Work alone. Do not spawn sub-agents, do not delegate, do not use any task or
agent tool. Do every edit yourself, in this session.

## Background, in one paragraph

Chinese articles in this archive were written with a typed space between
Chinese characters and English words or numbers, like `一名 OIer 时`. The site
stylesheet now sets `text-autospace: normal`, so the browser inserts that gap
itself, at a better width. But a browser will not insert a gap where a space
character is already sitting. So the typed spaces have to go, and then the
browser does the work. That is the whole migration.

## Hard rules

1. The only edit you may make is deleting a single space character.
2. Never add a character. Never change a word. Never translate anything.
   Never reflow, rewrap, or reindent a line. Never reorder anything.
3. Never edit a line the tool did not report.
4. Never edit a file outside `src/content/`.
5. Never run `git add`, `git commit`, `git push`, `git checkout`, or
   `git restore`. Never delete a file.
6. Never spawn a sub-agent or delegate any part of this task.

## The tool that tells you what to do

Run this to see every remaining space, across the whole archive:

```sh
node scripts/check-autospace.ts
```

Run this to see only the ones in a single file:

```sh
node scripts/check-autospace.ts path/to/file.md
```

Each report entry looks like this:

```
  src/content/blog/2022/01/web-archive/zh.md:12:65
    一堆死链。前段时间整理收藏夹时发现，在我还是一名 OIer 时收藏的许多算法文章
    → delete the space; the engine inserts it
```

The first line is `file:line:column`. The second line is a piece of that line
of the file, shown so you can see the space in question.

The tool already decided what is safe to touch. It skips front matter, code
blocks, inline code, link addresses, and URLs. You do not have to think about
any of that. If the tool did not report a space, that space stays.

## The loop

Do this once per file, and finish each file completely before starting the
next one.

1. Run `node scripts/check-autospace.ts` with no arguments.
2. Take the first file path that appears in the output. Call it FILE.
3. Run `node scripts/check-autospace.ts FILE`. This is your worklist for FILE.
4. Group the entries by line number. Handle one line at a time.
5. For a line, read that exact line from FILE. Write a new version of that
   line that is identical except that the spaces the tool reported on that
   line are gone. Replace the old line with the new line.
6. Repeat step 5 until every line in the worklist for FILE is done.
7. Run `node scripts/check-autospace.ts FILE` again. It must print
   `check-autospace: OK`. If it still reports problems, go back to step 4 and
   fix the ones that remain.
8. Run `git diff FILE` and read it. Every changed line must differ from the
   original only by missing spaces. If any line gained a character, or lost a
   word, or moved, undo your change to that line by hand and redo it
   correctly.
9. Go back to step 1.

Stop when `node scripts/check-autospace.ts` with no arguments prints
`check-autospace: OK`.

## Worked example

The tool reports:

```
  src/content/blog/2022/02/example/zh.md:16:5
    1898 年 1 月 13 日，著名作家左拉在《震旦报》上
  src/content/blog/2022/02/example/zh.md:16:7
    1898 年 1 月 13 日，著名作家左拉在《震旦报》上
  src/content/blog/2022/02/example/zh.md:16:9
    1898 年 1 月 13 日，著名作家左拉在《震旦报》上
```

Three entries, all on line 16. Line 16 of the file reads:

```
1898 年 1 月 13 日，著名作家左拉在《震旦报》上发表了《我控诉》。
```

You replace it with:

```
1898年1月13日，著名作家左拉在《震旦报》上发表了《我控诉》。
```

Four spaces are gone rather than three, because `13 日` is also a reported
boundary further along the same line. The comma, the book-title brackets, and
every word are untouched.

## When you are unsure

If you cannot tell what a reported space is, skip that one entry, leave the
file as it is, and write the `file:line:column` into a list. Do not guess. Do
not edit around it. At the end, report the skipped list.

If a command fails, or a file will not save, stop and report. Do not try a
different approach.

## When everything is done

Run these two commands and paste their output into your final message:

```sh
node scripts/check-autospace.ts
npm run check
```

Then report:

- how many files you changed,
- the output of `git diff --stat`,
- the list of entries you skipped, if any.

Do not commit. Leave the changes in the working tree for review.

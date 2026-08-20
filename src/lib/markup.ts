import {
  defineMdastPlugin,
  type MdastContent,
  type MdastPluginInstance,
  type MdastVisitorContext,
} from "satteri";

import {
  assertNever,
  invalid,
  mapParsed,
  ok,
  okUnless,
  orThrow,
  type Parsed,
} from "../prelude/adt.ts";
import { clashesBy } from "../prelude/distinct.ts";
import { SITE_LANG, parseLang, type Lang } from "./lang.ts";

/**
 * Custom inline tags for the Markdown archive, and the rule that keeps them
 * from colliding with prose.
 *
 * The syntax is the CommonMark generic-directive proposal, which Sätteri
 * parses natively: `:name[payload]` inline, `::name[payload]` on a line of
 * its own. Nothing here lexes anything; a hand-rolled sigil would be a second
 * grammar to get wrong, and this one already has a parser.
 *
 * The design copies KaTeX's, which is what makes `$` safe to write in prose:
 * a `$` opens math only when a `$` closes it, so an unpaired one is a dollar
 * sign and not a syntax error. The bracket is this grammar's closing
 * delimiter, and the same law follows.
 *
 *     :backup[https://archive.is/jca7Z]   a directive: paired, named, known
 *     :tada:                              not a directive: never parsed as one
 *     10:30                               not a directive: unpaired, so literal
 *
 * That last line is why the rule is load-bearing rather than decorative.
 * Sätteri parses `10:30` as a directive named `30` and, finding no renderer,
 * drops it: the paragraph silently ships as `10`. Restoring an unpaired name
 * to its own text is what makes ordinary prose survive the feature being on.
 *
 * The registry is closed, so the remaining cases are decided rather than
 * discovered:
 *
 *   - a registered name compiles, and a malformed payload fails the build;
 *   - an unregistered name with no payload is prose, and stays prose;
 *   - an unregistered name *with* a payload is a typo, and fails the build.
 *
 * A typo cannot be silently shipped, and a colon cannot be accidentally
 * eaten. Escape a literal `:` that would otherwise pair as `\:`.
 *
 * "Fails the build" is arranged rather than assumed: see `failures` below for
 * why the obvious two ways of failing do not, and `assertMarkupClean` for the
 * one that does.
 */

/**
 * How many colons the author writes, and therefore where the tag may sit.
 * The count selects the scope exactly as `$` and `$$` do: one for a span
 * inside a paragraph, two for a block standing alone.
 *
 * `:::`, the container form, is deliberately absent. A container wraps
 * *content* rather than consuming a payload, so it needs the other rendering
 * mode, and shipping that mode with nothing using it would leave the one
 * trap this module exists to avoid: a future container directive would
 * silently drop its own children. The shell rejects `:::` by name until a
 * container is actually wanted.
 */
export type Arity = "text" | "leaf";

/** The sigil an arity is written with; also how an unpaired name is restored. */
const SIGIL: Readonly<Record<Arity, string>> = { text: ":", leaf: "::" };

/**
 * What the author wrote between the delimiters, untrusted and unparsed.
 *
 * Absent, rather than empty, when the name was unpaired: "no payload" is the
 * signal that decides prose from markup, so it is a distinct value and not an
 * empty string one branch has to remember to test for.
 */
export type Payload = {
  /** The text of `[...]`, flattened. */
  readonly label: string;
  /** The `{key=value}` pairs, which no directive requires yet. */
  readonly attributes: Readonly<Record<string, string>>;
};

/** What a directive may know about the document it is rendering into. */
export type MarkupContext = {
  /** The rendition's language, so a tag can name itself in the reader's. */
  readonly lang: Lang;
};

/**
 * A registered tag: a name, where it may be written, and one total function
 * from what the author typed to what the reader gets.
 *
 * `compile` is the composition of a directive's own `parse` and `render`, so
 * the payload type each directive parses *to* stays inside the closure that
 * produced it. Without that, the registry would need a type parameter it
 * could not have, being a list of directives that disagree about it.
 */
export type Directive = {
  readonly name: string;
  readonly arity: Arity;
  readonly compile: (payload: Payload, cx: MarkupContext) => Parsed<MdastContent>;
};

/**
 * The only way to build one. Parsing is separated from rendering so that
 * `render` is total over a type that already excludes what it cannot draw:
 * a renderer never inspects a string to decide whether it is a URL.
 */
export const directive = <P>(spec: {
  readonly name: string;
  readonly arity: Arity;
  readonly parse: (payload: Payload) => Parsed<P>;
  readonly render: (value: P, cx: MarkupContext) => MdastContent;
}): Directive => ({
  name: spec.name,
  arity: spec.arity,
  compile: (payload, cx) =>
    mapParsed(spec.parse(payload), (value) => spec.render(value, cx)),
});

/** Name to directive. Built once; every lookup below is a hash hit. */
export type Registry = ReadonlyMap<string, Directive>;

/**
 * Admit a list of directives as a registry, refusing two claims on one name.
 * A clash is a defect in this project's own source, so it throws at import
 * exactly as a malformed language config does, rather than resolving to
 * whichever entry happened to be written last.
 */
export const registryOf = (directives: readonly Directive[]): Registry =>
  new Map(
    orThrow(
      okUnless(
        clashesBy(directives, ({ name }) => name).map(
          ([, later]) => `${JSON.stringify(later.name)} is declared twice`,
        ),
        directives,
      ),
      "markup registry",
    ).map((entry) => [entry.name, entry]),
  );

/**
 * What a directive site becomes: either the reader's content, or the source
 * text handed back untouched because it was never markup to begin with.
 */
export type Rendered =
  | { readonly tag: "content"; readonly node: MdastContent }
  | { readonly tag: "literal"; readonly text: string };

/**
 * The decision procedure, and the whole of this module's logic. Pure and
 * total: every combination of arity, name, and payload lands in exactly one
 * of the three cases the header states.
 *
 * O(1) besides the directive's own parse, which is linear in its payload.
 */
export const resolve = (
  registry: Registry,
  arity: Arity,
  name: string,
  payload: Payload | undefined,
  cx: MarkupContext,
): Parsed<Rendered> => {
  const found = registry.get(name);

  if (found === undefined) {
    /* Unpaired and unknown: prose that happens to contain a colon. Restoring
       the text is the point, and `text` arity is the only one prose reaches;
       `::` at the start of a line is never an accident. */
    if (payload === undefined && arity === "text") {
      return ok({ tag: "literal", text: `${SIGIL[arity]}${name}` });
    }
    return invalid(
      `unknown directive ${JSON.stringify(name)}; defined directives are ${[...registry.keys()].join(", ")}`,
    );
  }

  if (found.arity !== arity) {
    return invalid(
      `${JSON.stringify(name)} is a ${found.arity} directive, written ${SIGIL[found.arity]}${name}, not ${SIGIL[arity]}${name}`,
    );
  }

  /* A registered name with nothing paired to it is a directive missing its
     payload, not prose: the directive's own parser says what it needed. */
  return mapParsed(
    found.compile(payload ?? { label: "", attributes: {} }, cx),
    (node) => ({ tag: "content", node }),
  );
};

// ---------------------------------------------------------------------------
// Effect boundary: the Sätteri plugin
// ---------------------------------------------------------------------------

/**
 * A directive node, in the shape this module reads: a name, and whatever the
 * author paired to it. Structural rather than one of Sätteri's three node
 * types, because all three are read identically and the arity is already a
 * parameter.
 */
type Site = {
  readonly name: string;
  readonly attributes?:
    Readonly<Record<string, string | null | undefined>> | null | undefined;
  readonly children?: readonly unknown[] | undefined;
};

/**
 * The two node types the visitors receive, taken from the plugin interface
 * rather than from Sätteri's internal module: they are the same types, and
 * this way the import stays on the package's public surface.
 */
type DirectiveNode =
  | Parameters<NonNullable<MdastPluginInstance["textDirective"]>>[0]
  | Parameters<NonNullable<MdastPluginInstance["leafDirective"]>>[0];

/** Only string-valued attributes; a bare `{flag}` carries no value to parse. */
const attributesOf = (site: Site): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(site.attributes ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

/**
 * The payload, or `undefined` when the name was written bare.
 *
 * Sätteri leaves `children` unresolved on a directive with no label, so its
 * absence is the label's absence; an empty `[]` still yields a child and so
 * still counts as paired.
 */
const payloadOf = (site: Site, label: string): Payload | undefined => {
  const attributes = attributesOf(site);
  const paired = (site.children?.length ?? 0) > 0 || Object.keys(attributes).length > 0;
  return paired ? { label, attributes } : undefined;
};

/**
 * The rendition language, read from the file being compiled.
 *
 * Renditions are named for their language (`.../slug/zh.md`), which
 * `archive.ts` already relies on, so the document's own path is the answer
 * and no second declaration is needed. Total by construction: anything that
 * is not a rendition, including a compile with no file at all, renders in the
 * site language.
 */
export const langOf = (fileURL: URL | undefined): Lang => {
  if (fileURL === undefined) return SITE_LANG;
  const stem =
    fileURL.pathname
      .split("/")
      .at(-1)
      ?.replace(/\.[^.]+$/, "") ?? "";
  const parsed = parseLang(stem);
  return parsed.tag === "ok" ? parsed.value : SITE_LANG;
};

/** Where the author must go to fix it: the rendition, and the line. */
const whereIs = (
  fileURL: URL | undefined,
  node: { readonly position?: unknown },
): string => {
  const file = fileURL?.pathname ?? "markdown";
  const start = (node.position as { start?: { line?: number } } | undefined)?.start;
  return start?.line === undefined ? file : `${file}:${start.line}`;
};

/**
 * Every rejected directive of the run, in the order they were met.
 *
 * A build-scoped accumulator is not the first shape reached for, and the two
 * tidier ones do not work. Throwing from a visitor is swallowed: Astro
 * catches whatever a Markdown plugin raises, so the build goes green and the
 * offending tag ships as a *hole* in the paragraph. `ctx.report({ severity:
 * "error" })` is quieter still, because Astro never reads Sätteri's
 * diagnostics at all. Both were tried here, and both left exactly the outcome
 * this module exists to prevent.
 *
 * So the failure outlives the visitor that found it, and `assertMarkupClean`
 * raises it where Astro does listen. The list is module-scoped because the
 * pipeline gives a plugin nowhere else to put it; it is append-only, drained
 * once, and never read by the pure core.
 */
const failures: string[] = [];

/**
 * Fail the build if any directive was rejected, naming every one.
 *
 * Called from an `astro:build:done` hook, which is a boundary Astro does
 * propagate. Draining keeps a watch-mode rebuild from re-reporting what the
 * previous pass already reported.
 */
export const assertMarkupClean = (): void => {
  const found = failures.splice(0);
  if (found.length > 0) {
    throw new TypeError(
      `markup rejected ${found.length} directive(s):\n  ${found.join("\n  ")}`,
    );
  }
};

/** What the author typed, rebuilt from the parse, for a failure to hand back. */
const sourceOf = (arity: Arity, name: string, payload: Payload | undefined): string =>
  payload === undefined
    ? `${SIGIL[arity]}${name}`
    : `${SIGIL[arity]}${name}[${payload.label}]`;

/** The renderer. */
export const markupPlugin = (registry: Registry) => {
  const eliminate = (
    arity: Arity,
    node: DirectiveNode,
    ctx: MdastVisitorContext,
  ): void => {
    const payload = payloadOf(node, ctx.textContent(node));
    const resolved = resolve(registry, arity, node.name, payload, {
      lang: langOf(ctx.fileURL),
    });

    switch (resolved.tag) {
      case "invalid":
        failures.push(`${whereIs(ctx.fileURL, node)}: ${resolved.reasons.join("; ")}`);
        /* Hand the source back rather than leaving the node for Sätteri to
           drop. The build is already condemned, so this is for the author
           watching `astro dev`, where no hook runs: a tag that is wrong stays
           on the page, misspelt and visible, instead of disappearing. */
        ctx.replaceNode(node, {
          type: "text",
          value: sourceOf(arity, node.name, payload),
        });
        return;
      case "ok":
        switch (resolved.value.tag) {
          case "content":
            ctx.replaceNode(node, resolved.value.node);
            return;
          case "literal":
            ctx.replaceNode(node, { type: "text", value: resolved.value.text });
            return;
          default:
            return assertNever(resolved.value);
        }
      default:
        return assertNever(resolved);
    }
  };

  return defineMdastPlugin({
    name: "markup",
    textDirective: (node, ctx) => eliminate("text", node, ctx),
    leafDirective: (node, ctx) => eliminate("leaf", node, ctx),
    /* See `Arity`: containers are recognised only so they fail loudly. An
       unhandled directive is dropped, so saying nothing here would delete the
       block and everything inside it. */
    containerDirective: (node, ctx) => {
      failures.push(
        `${whereIs(ctx.fileURL, node)}: container directive ${JSON.stringify(node.name)}; none are defined, and ':::' has no meaning in this project`,
      );
    },
  });
};

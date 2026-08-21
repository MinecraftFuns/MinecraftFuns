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

/** Parse paired directives while preserving unpaired prose such as `10:30`. */

/** Text (`:`) or leaf (`::`) directive; containers are unsupported. */
export type Arity = "text" | "leaf";

/** Sigil for each arity and for restoring unpaired names. */
const SIGIL: Readonly<Record<Arity, string>> = { text: ":", leaf: "::" };

/** Parsed directive payload; `undefined` means the name was unpaired. */
export type Payload = {
  /** Text inside `[...]`. */
  readonly label: string;
  /** Parsed `{key=value}` attributes. */
  readonly attributes: Readonly<Record<string, string>>;
};

/** Context available while rendering a directive. */
export type MarkupContext = {
  /** Rendition language. */
  readonly lang: Lang;
};

/** Registered directive compiler. */
export type Directive = {
  readonly name: string;
  readonly arity: Arity;
  readonly compile: (payload: Payload, cx: MarkupContext) => Parsed<MdastContent>;
};

/** Build a directive by parsing, then rendering, its payload. */
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

/** Name-indexed directive registry. */
export type Registry = ReadonlyMap<string, Directive>;

/** Build a registry; duplicate names are source defects. */
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

/** Directive result: rendered content or original source text. */
export type Rendered =
  | { readonly tag: "content"; readonly node: MdastContent }
  | { readonly tag: "literal"; readonly text: string };

/** Resolve name, arity, and payload into content or literal prose. */
export const resolve = (
  registry: Registry,
  arity: Arity,
  name: string,
  payload: Payload | undefined,
  cx: MarkupContext,
): Parsed<Rendered> => {
  const found = registry.get(name);

  if (found === undefined) {
    /* Unpaired text-arity names are prose; restore them unchanged. */
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

  /* Registered names require a payload, even when empty. */
  return mapParsed(
    found.compile(payload ?? { label: "", attributes: {} }, cx),
    (node) => ({ tag: "content", node }),
  );
};

/** Directive node fields used by this module. */
type Site = {
  readonly name: string;
  readonly attributes?:
    Readonly<Record<string, string | null | undefined>> | null | undefined;
  readonly children?: readonly unknown[] | undefined;
};

/** Visitor node types from the plugin's public interface. */
type DirectiveNode =
  | Parameters<NonNullable<MdastPluginInstance["textDirective"]>>[0]
  | Parameters<NonNullable<MdastPluginInstance["leafDirective"]>>[0];

/** Keep only string-valued attributes. */
const attributesOf = (site: Site): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(site.attributes ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

/** Return payload only when label or attributes are paired. */
const payloadOf = (site: Site, label: string): Payload | undefined => {
  const attributes = attributesOf(site);
  const paired = (site.children?.length ?? 0) > 0 || Object.keys(attributes).length > 0;
  return paired ? { label, attributes } : undefined;
};

/**
 * The language a directive renders in.
 *
 * The page cannot hand this down: Markdown is compiled before the component
 * that knows the rendition exists. So this reads the same authority the
 * article model reads: the filename, exactly as `archive.ts` reads it. `zh.md`
 * *is* the Chinese rendition, and nothing else in the file says so.
 *
 * The site language is a decision here rather than a fallback, and the
 * distinction matters: a name that is not a language code belongs to a
 * document that has only one language (`declaration.md`, a doc), and a
 * rendition's name always parses, because `article.ts` refuses to build an
 * article from a file whose name it cannot read. There is no third case in
 * which this quietly guesses wrong.
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

/** Format the source location for a directive error. */
const whereIs = (
  fileURL: URL | undefined,
  node: { readonly position?: unknown },
): string => {
  const file = fileURL?.pathname ?? "markdown";
  const start = (node.position as { start?: { line?: number } } | undefined)?.start;
  return start?.line === undefined ? file : `${file}:${start.line}`;
};

/**
 * Where a traversal puts the directives it refused.
 *
 * The plugin and the build hook that raises its findings live in different
 * modules, so the channel between them has to be something one can hold. A
 * module-global array made that connection invisible to the typechecker and
 * shared one log between every plugin a process constructs.
 */
export type Rejections = {
  readonly record: (message: string) => void;
  /** Raise everything recorded so far, and empty the log. */
  readonly assertClean: () => void;
};

/** A fresh, independent rejection log. Mutation stays inside the closure. */
export const rejectionLog = (): Rejections => {
  const found: string[] = [];
  return {
    record: (message) => void found.push(message),
    assertClean: () => {
      const drained = found.splice(0);
      if (drained.length > 0) {
        throw new TypeError(
          `markup rejected ${drained.length} directive(s):\n  ${drained.join("\n  ")}`,
        );
      }
    },
  };
};

/** Rebuild rejected source for development output. */
const sourceOf = (arity: Arity, name: string, payload: Payload | undefined): string =>
  payload === undefined
    ? `${SIGIL[arity]}${name}`
    : `${SIGIL[arity]}${name}[${payload.label}]`;

/** Sätteri renderer, recording what it refuses into the given log. */
export const markupPlugin = (registry: Registry, rejected: Rejections) => {
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
        rejected.record(`${whereIs(ctx.fileURL, node)}: ${resolved.reasons.join("; ")}`);
        /* Keep rejected source visible in `astro dev`; the build hook reports it. */
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
    /* Reject unsupported containers instead of dropping their contents. */
    containerDirective: (node, ctx) => {
      rejected.record(
        `${whereIs(ctx.fileURL, node)}: container directive ${JSON.stringify(node.name)}; none are defined, and ':::' has no meaning in this project`,
      );
    },
  });
};

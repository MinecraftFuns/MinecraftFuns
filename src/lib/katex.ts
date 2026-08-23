import katex from "katex";
import { defineHastPlugin } from "satteri";

/**
 * Build-time TeX rendering for the Markdown pipeline.
 *
 * Sätteri's `math` feature parses `$…$` and `$$…$$` but renders them as
 * `<code class="language-math …">` carrying the raw TeX, which is why the
 * default Shiki config excludes the `math` language: the node is a
 * placeholder awaiting a renderer. This plugin is that renderer. KaTeX
 * compiles each span to static markup styled by the stylesheet
 * `ArticlePage` imports, so no page ships client-side rendering for what
 * never changes after the build.
 *
 * `throwOnError` is deliberate and true by default: malformed TeX fails the
 * build with KaTeX's own message rather than shipping a paragraph with a
 * red hole in it. The archive being migrated is maths-heavy enough that a
 * silent fallback would eventually be exercised.
 */

const MATH_CLASS = "language-math";
const DISPLAY_CLASS = "math-display";

const classesOf = (className: unknown): readonly string[] =>
  Array.isArray(className) ? className.filter((c) => typeof c === "string") : [];

export const katexRendering = defineHastPlugin({
  name: "katex-rendering",
  element: {
    filter: ["code"],
    visit(node, ctx) {
      const classes = classesOf(node.properties["className"]);
      if (!classes.includes(MATH_CLASS)) return;

      const display = classes.includes(DISPLAY_CLASS);
      const html = katex.renderToString(ctx.textContent(node), {
        displayMode: display,
        output: "htmlAndMathml",
      });

      /* Display math arrives wrapped in a `<pre>`; the wrapper is part of
         the placeholder, so it goes with it. The parent lookup is guarded
         rather than assumed: inline math has a paragraph parent that must
         survive. */
      const parent = ctx.parent(node);
      const target =
        display &&
        parent !== undefined &&
        parent.type === "element" &&
        parent.tagName === "pre"
          ? parent
          : node;

      ctx.replaceNode(target, { type: "raw", value: html });
    },
  },
});

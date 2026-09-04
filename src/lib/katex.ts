import katex from "katex";
import { defineMdastPlugin } from "satteri";

/**
 * Build-time TeX rendering for the Markdown pipeline.
 *
 * Sätteri's `math` feature parses TeX into two node types and renders
 * neither, so without a renderer the source reaches the page as literal
 * dollar signs. This plugin is that renderer. KaTeX compiles each node to
 * static markup styled by the stylesheet `ArticlePage` imports, so no page
 * ships client-side rendering for what never changes after the build.
 *
 * Which node a formula becomes is a property of how it is written, and the
 * two spellings of `$$` do not agree. `$$x$$` closed on one line is an
 * `inlineMath` node, the same type `$x$` produces; `$$` alone on its own
 * line, content between, `$$` alone to close, is a `math` node and the only
 * spelling that renders as display math. A `$$` opened on a line that also
 * carries content and left to close on a later line is neither: the parser
 * takes it for an indented block and swallows the rest of the document into
 * a code block.
 *
 * The mdast placement is load-bearing. Astro orders its syntax highlighter
 * ahead of user hast plugins, and by hast a `math` node has already become
 * `<pre><code>`, which Shiki claims as plaintext before a hast plugin runs. On
 * mdast the node arrives ahead of the highlighter and its type carries the
 * distinction outright.
 *
 * `throwOnError` is set and nothing here catches, so malformed TeX fails the
 * build with KaTeX's own message rather than shipping a paragraph with a red
 * hole in it.
 */

const render = (displayMode: boolean) => (node: { readonly value: string }) => ({
  type: "html" as const,
  value: katex.renderToString(node.value, {
    displayMode,
    output: "htmlAndMathml",
    throwOnError: true,
  }),
});

export const katexRendering = defineMdastPlugin({
  name: "katex-rendering",
  math: render(true),
  inlineMath: render(false),
});

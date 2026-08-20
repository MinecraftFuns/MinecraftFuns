import sharp from "sharp";

import markSource from "../assets/favicon.svg?raw";
import { once } from "../prelude/memo.ts";
import { encodeIco, iconSizes, type IconSize } from "./ico.ts";

/**
 * Every icon the site serves, derived from `src/assets/favicon.svg`.
 *
 * The SVG is the mark; the rest are renderings of it. Drawing them once and
 * committing the results would put the same shape in five files that nothing
 * forces to agree, which is how a site ends up with a redesigned tab icon and
 * a year-old home-screen icon. These are built from the source on every build
 * instead, so the mark cannot be half-updated.
 *
 * Only the SVG can follow the reader's colour scheme, the `<style>` inside it
 * carrying its own `prefers-color-scheme` rule. A raster has to pick one, and
 * picks the light one: it is what the media query defaults to, and an icon on
 * an iOS home screen sits on the user's wallpaper rather than on either of
 * the site's backgrounds.
 */

/**
 * The mark itself.
 *
 * Imported rather than read from disk, and the difference is not stylistic:
 * these modules are bundled before they run, so `import.meta.url` names a
 * chunk under `dist/` and any path relative to it points at nothing. `?raw`
 * makes the bundler carry the file's text, which also makes the dependency
 * one it can see, so editing the mark reloads the icons in `astro dev`.
 *
 * It lives in `src/assets` rather than `public` for the same reason. A file
 * in `public` is copied out untouched and cannot be imported; the mark is a
 * *source*, and all three icons the site serves are rendered from it.
 */
const mark = once(() => Buffer.from(markSource));

/**
 * Sizes in the ICO. 16 and 32 are what a tab and a bookmark bar ask for; 48
 * is what Windows uses for a desktop shortcut. Larger belongs to the SVG,
 * which has no sizes at all.
 */
const ICO_SIZES = iconSizes(16, 32, 48);

/** iOS home screen. One size: 180 covers every Retina phone and tablet. */
const APPLE_SIZE = iconSizes(180)[0];

/**
 * The brand's paper. Apple composites a home-screen icon over an unknown
 * wallpaper and applies its own rounded mask, so the icon must be opaque: the
 * transparent corners the mark's own rounding leaves would otherwise show the
 * wallpaper through the mask's own corners.
 */
const OPAQUE_BACKGROUND = "#f8f5ed";

/**
 * Render the mark at one size.
 *
 * Rasterised *at* the target rather than drawn large and scaled down: the
 * mark is two rounded rectangles, and rendering at size lets the vector
 * renderer place the edges, where downsampling would blur them. `density`
 * is how that is asked for, being dots per inch against the SVG's own
 * intrinsic size, which is read from the file rather than assumed.
 */
const render = async (
  size: IconSize,
  background?: string,
): Promise<Uint8Array<ArrayBuffer>> => {
  const svg = mark();
  const { width = size } = await sharp(svg).metadata();
  const pipeline = sharp(svg, { density: Math.ceil((72 * size) / width) }).resize(
    size,
    size,
  );

  const flattened =
    background === undefined ? pipeline : pipeline.flatten({ background });
  return new Uint8Array(await flattened.png().toBuffer());
};

/** `/favicon.ico`: the icon a browser asks for when it has no HTML to read. */
export const faviconIco = once(async (): Promise<Uint8Array<ArrayBuffer>> => {
  const images = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, png: await render(size) })),
  );

  /* `ICO_SIZES` is `NonEmpty` and `map` preserves length, which `Promise.all`
     resolves elementwise; the cast restores what the array type forgot. */
  return encodeIco(images as unknown as Parameters<typeof encodeIco>[0]);
});

/** `/apple-touch-icon.png`: opaque, because iOS masks it over a wallpaper. */
export const appleTouchIcon = once((): Promise<Uint8Array<ArrayBuffer>> =>
  render(APPLE_SIZE, OPAQUE_BACKGROUND),
);

/** `/favicon.svg`: the mark itself, the only form that follows the theme. */
export const faviconSvg = (): string => markSource;

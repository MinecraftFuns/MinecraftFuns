import sharp from "sharp";

import markSource from "../assets/favicon.svg?raw";
import { once } from "../prelude/memo.ts";
import { encodeIco, iconSizes, type IconSize } from "./ico.ts";

/** Derive all served icons from the source SVG; only SVG follows color scheme. */

/** Bundled SVG source; `?raw` keeps it available to icon renderers. */
const mark = once(() => Buffer.from(markSource));

/*
 * ICO sizes. 16/32/48 serve tabs and classic shortcut sizes; 256 is what
 * Windows actually renders for pinned taskbar and large-icon views, and what
 * HiDPI displays downscale from. Payloads are PNG-compressed, so the largest
 * entry costs a few kilobytes, not the 256 KiB a BMP entry would.
 */
const ICO_SIZES = iconSizes(16, 32, 48, 256);

/** iOS home-screen size. */
const APPLE_SIZE = iconSizes(180)[0];

/** Opaque background for Apple's mask and unknown wallpaper. */
const OPAQUE_BACKGROUND = "#f8f5ed";

/** Rasterize the mark at target size to keep rounded edges sharp. */
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

/** `/favicon.ico` payload. */
export const faviconIco = once(async (): Promise<Uint8Array<ArrayBuffer>> => {
  const images = await Promise.all(
    ICO_SIZES.map(async (size) => ({ size, png: await render(size) })),
  );

  /* `Promise.all` preserves the non-empty mapped image list. */
  return encodeIco(images as unknown as Parameters<typeof encodeIco>[0]);
});

/** Opaque `/apple-touch-icon.png` payload. */
export const appleTouchIcon = once((): Promise<Uint8Array<ArrayBuffer>> =>
  render(APPLE_SIZE, OPAQUE_BACKGROUND),
);

/** Theme-aware `/favicon.svg` payload. */
export const faviconSvg = (): string => markSource;

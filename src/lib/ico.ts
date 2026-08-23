import {
  invalid,
  mapNonEmpty,
  ok,
  orThrow,
  type NonEmpty,
  type Parsed,
} from "../prelude/adt.ts";

/** Handwritten ICO encoder for the browser's implicit favicon request. */

/** ICO edge size; 256 encodes as 0. */
declare const iconSizeBrand: unique symbol;
export type IconSize = number & { readonly [iconSizeBrand]: true };

export const parseIconSize = (size: number): Parsed<IconSize> =>
  Number.isInteger(size) && size >= 1 && size <= 256
    ? ok(size as IconSize)
    : invalid(`${size} is not a whole number of pixels between 1 and 256`);

/** Validate trusted module-level sizes. */
export const iconSizes = (...sizes: NonEmpty<number>): NonEmpty<IconSize> =>
  mapNonEmpty(sizes, (size) => orThrow(parseIconSize(size), "icon size"));

/** ICO image with PNG payload. */
export type IconImage = {
  readonly size: IconSize;
  readonly png: Uint8Array;
};

const HEADER_BYTES = 6;
const ENTRY_BYTES = 16;

/** Encode PNG images in ICO directory layout. */
export const encodeIco = (images: NonEmpty<IconImage>): Uint8Array<ArrayBuffer> => {
  const total =
    HEADER_BYTES +
    ENTRY_BYTES * images.length +
    images.reduce((sum, { png }) => sum + png.length, 0);

  const file = new Uint8Array(total);
  const view = new DataView(file.buffer);

  /* ICO header: reserved, type, image count; all little-endian. */
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);

  /* Payloads follow the directory; offset advances after each image. */
  let offset = HEADER_BYTES + ENTRY_BYTES * images.length;

  images.forEach(({ size, png }, index) => {
    const entry = HEADER_BYTES + ENTRY_BYTES * index;

    /* ICO uses 0 to encode a 256-pixel edge. */
    file[entry] = size % 256;
    file[entry + 1] = size % 256;
    file[entry + 2] = 0; // palette size: 0 for a truecolour image
    file[entry + 3] = 0; // reserved
    view.setUint16(entry + 4, 1, true); // colour planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, png.length, true);
    view.setUint32(entry + 12, offset, true);

    file.set(png, offset);
    offset += png.length;
  });

  return file;
};

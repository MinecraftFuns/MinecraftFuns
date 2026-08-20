import { invalid, ok, orThrow, type NonEmpty, type Parsed } from "../prelude/adt.ts";

/**
 * The ICO container, written by hand.
 *
 * ICO is a directory of images in one file, and the only reason this project
 * needs one is that a browser asking for a favicon *implicitly*, having no
 * HTML to read a `<link>` from, asks for `/favicon.ico` and nothing else.
 * The format has been frozen since 1995 and the part used here is a 6-byte
 * header, a 16-byte entry per image, and the images concatenated after them;
 * the payloads are PNG, which every browser since IE 11 reads inside an ICO.
 *
 * Written out rather than depended on because a dependency for forty lines of
 * fixed binary layout is a supply chain for a `DataView`. The layout is
 * asserted by tests that read the bytes back.
 */

/**
 * The edge of a square icon, in pixels: 1 to 256.
 *
 * Branded because the upper bound is the format's, not a preference. An entry
 * stores the edge in a *byte*, so 256 is written as 0 and 257 cannot be
 * written at all: the value that silently becomes a 1-pixel icon is the one
 * this type exists to keep out.
 */
declare const iconSizeBrand: unique symbol;
export type IconSize = number & { readonly [iconSizeBrand]: true };

export const parseIconSize = (size: number): Parsed<IconSize> =>
  Number.isInteger(size) && size >= 1 && size <= 256
    ? ok(size as IconSize)
    : invalid(`${size} is not a whole number of pixels between 1 and 256`);

/** Sizes trusted at module load; a bad literal here is a defect, not input. */
export const iconSizes = (...sizes: NonEmpty<number>): NonEmpty<IconSize> =>
  sizes.map((size) =>
    orThrow(parseIconSize(size), "icon size"),
  ) as unknown as NonEmpty<IconSize>;

/** One image in the directory, already encoded as PNG. */
export type IconImage = {
  readonly size: IconSize;
  readonly png: Uint8Array;
};

const HEADER_BYTES = 6;
const ENTRY_BYTES = 16;

/**
 * Lay the directory out and concatenate the payloads.
 *
 * Total: every field is bounded by `IconSize` or by the payload lengths, and
 * the offsets are computed in one left-to-right pass, so there is no
 * arrangement of inputs that produces a malformed file.
 *
 * O(n) entries and O(total payload) bytes copied, for n the number of sizes,
 * which is three.
 */
export const encodeIco = (images: NonEmpty<IconImage>): Uint8Array<ArrayBuffer> => {
  const total =
    HEADER_BYTES +
    ENTRY_BYTES * images.length +
    images.reduce((sum, { png }) => sum + png.length, 0);

  const file = new Uint8Array(total);
  const view = new DataView(file.buffer);

  /* ICONDIR: reserved, then type 1 for an icon, then the count. Little-endian
     throughout, the format being a DOS-era Microsoft one. */
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);

  /* Payloads follow every entry, so the first one starts where the table
     ends and each subsequent one after its predecessor. */
  let offset = HEADER_BYTES + ENTRY_BYTES * images.length;

  images.forEach(({ size, png }, index) => {
    const entry = HEADER_BYTES + ENTRY_BYTES * index;

    /* 256 does not fit a byte and is written as 0, which the format defines
       to mean 256. `IconSize` has already excluded everything else. */
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

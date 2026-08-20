import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { encodeIco, iconSizes, parseIconSize, type IconImage } from "./ico.ts";
import type { NonEmpty } from "../prelude/adt.ts";

/** A payload distinguishable from its neighbours, so offsets can be checked. */
const payload = (byte: number, length: number): Uint8Array =>
  new Uint8Array(length).fill(byte);

const image = (size: number, byte: number, length: number): IconImage => ({
  size: iconSizes(size)[0],
  png: payload(byte, length),
});

const read = (ico: Uint8Array) =>
  new DataView(ico.buffer, ico.byteOffset, ico.byteLength);

describe("parseIconSize", () => {
  it("accepts the whole range the format can express", () => {
    for (const size of [1, 16, 32, 48, 180, 256]) {
      assert.equal(parseIconSize(size).tag, "ok", `${size} should be accepted`);
    }
  });

  it("refuses what a one-byte field cannot hold or would silently truncate", () => {
    // 257 would be written as 1 and produce a one-pixel icon.
    for (const size of [0, -1, 257, 512, 16.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(parseIconSize(size).tag, "invalid", `${size} should be refused`);
    }
  });

  it("throws through iconSizes, a bad literal being a defect", () => {
    assert.throws(() => iconSizes(0), /between 1 and 256/);
  });
});

describe("encodeIco", () => {
  const images: NonEmpty<IconImage> = [image(16, 0xaa, 10), image(32, 0xbb, 20)];
  const ico = encodeIco(images);
  const view = read(ico);

  it("writes the ICONDIR: reserved, type 1, and the count", () => {
    assert.equal(view.getUint16(0, true), 0);
    assert.equal(view.getUint16(2, true), 1);
    assert.equal(view.getUint16(4, true), 2);
  });

  it("is exactly header plus entries plus payloads, with nothing spare", () => {
    assert.equal(ico.length, 6 + 16 * 2 + 10 + 20);
  });

  it("records each entry's declared size", () => {
    assert.equal(ico[6], 16);
    assert.equal(ico[6 + 1], 16);
    assert.equal(ico[6 + 16], 32);
    assert.equal(ico[6 + 16 + 1], 32);
  });

  it("points every entry at its own payload", () => {
    for (const [index, expected] of [
      [0, { length: 10, byte: 0xaa }],
      [1, { length: 20, byte: 0xbb }],
    ] as const) {
      const entry = 6 + 16 * index;
      const length = view.getUint32(entry + 8, true);
      const offset = view.getUint32(entry + 12, true);

      assert.equal(length, expected.length);
      assert.deepEqual(
        ico.slice(offset, offset + length),
        payload(expected.byte, expected.length),
        `entry ${index} must point at its own bytes`,
      );
    }
  });

  it("writes 256 as 0, which is what the format defines it to mean", () => {
    const big = encodeIco([image(256, 0xcc, 4)]);
    assert.equal(big[6], 0);
    assert.equal(big[6 + 1], 0);
  });

  it("lays a single image out with its payload straight after the entry", () => {
    const one = encodeIco([image(48, 0xdd, 7)]);
    assert.equal(read(one).getUint32(6 + 12, true), 6 + 16);
    assert.equal(one.length, 6 + 16 + 7);
  });
});

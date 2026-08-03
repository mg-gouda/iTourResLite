"use client";

// Minimal ZIP writer (store method, no compression). PDF streams are already
// compressed, so deflating them again buys almost nothing — this keeps the
// download to a few dozen lines instead of pulling in a zip dependency.
// Produces a standard archive: local file headers + central directory + EOCD.

export interface ZipEntry {
  /** File name inside the archive, e.g. "17295140 INV 20260146.pdf". */
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS timestamp: seconds have 2s resolution and the epoch is 1980. */
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Replace characters that are illegal in file names on Windows/macOS. */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "file";
}

export function zipSync(entries: ZipEntry[], now: Date = new Date()): Blob {
  const { time, date } = dosDateTime(now);
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true);         // version needed
    lv.setUint16(6, 0x0800, true);     // flags: UTF-8 file name
    lv.setUint16(8, 0, true);          // method: store
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);      // compressed size
    lv.setUint32(22, size, true);      // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);         // extra field length
    local.set(nameBytes, 30);

    parts.push(local, entry.data);

    const dir = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true); // central directory signature
    dv.setUint16(4, 20, true);         // version made by
    dv.setUint16(6, 20, true);         // version needed
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, time, true);
    dv.setUint16(14, date, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, size, true);
    dv.setUint32(24, size, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, offset, true);    // offset of the local header
    dir.set(nameBytes, 46);
    central.push(dir);

    offset += local.length + size;
  });

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);   // end of central directory signature
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);      // offset of the central directory

  // Concatenate into one buffer rather than handing the Blob a list of views —
  // a Uint8Array is not assignable to BlobPart under the current lib types.
  const chunks = [...parts, ...central, end];
  const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return new Blob([out.buffer as ArrayBuffer], { type: "application/zip" });
}

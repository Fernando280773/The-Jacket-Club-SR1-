import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { LABEL_PAD, LABEL_WIDTH, labelHeight, labelRows, type Label, type LabelRow } from "../label";
import { LABEL_LOGO } from "./label-logo";

type Font = { name: string; data: Buffer; weight: 400 | 700; style: "normal" };
let fonts: Promise<Font[]> | null = null;

/** Fonts bundled with the app (SIL Open Font Licence, see src/app/fonts). */
function loadFonts(): Promise<Font[]> {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/label/dm-sans-latin-400-normal.woff")),
    readFile(join(process.cwd(), "assets/label/dm-sans-latin-700-normal.woff")),
    readFile(join(process.cwd(), "assets/label/alfa-slab-one-latin-400-normal.woff")),
  ]).then(([regular, bold, display]) => [
    { name: "Body", data: regular, weight: 400, style: "normal" },
    { name: "Body", data: bold, weight: 700, style: "normal" },
    { name: "Display", data: display, weight: 400, style: "normal" },
  ]);
  return fonts;
}

/** Label width in dots: LABEL_WIDTH_DOTS on the server overrides the default (58 mm roll). */
export function labelWidth(): number {
  const n = Number(process.env.LABEL_WIDTH_DOTS);
  return Number.isInteger(n) && n >= 300 && n <= 832 ? n : LABEL_WIDTH;
}

function Row({ row, qr }: { row: LabelRow; qr: string | null }) {
  const base = { display: "flex", height: row.height, width: "100%", alignItems: "center" } as const;
  switch (row.kind) {
    case "head":
      return (
        <div style={{ ...base, alignItems: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LABEL_LOGO} width={140} height={140} alt="" />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 12, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>{row.count}</div>
            <div style={{ display: "flex", fontFamily: "Display", fontSize: row.name.length > 8 ? 34 : 44, lineHeight: 1.15 }}>{row.name}</div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>{row.order}</div>
          </div>
        </div>
      );
    case "banner":
      return <div style={{ ...base, justifyContent: "center", backgroundColor: "#000", color: "#fff", fontSize: 32, fontWeight: 700, letterSpacing: 1 }}>{row.text}</div>;
    case "test":
      return <div style={{ ...base, justifyContent: "center", fontSize: 24, fontWeight: 700, borderBottom: "3px solid #000" }}>STAFF TEST - NOT A REAL ORDER</div>;
    case "item":
      return <div style={{ ...base, fontSize: 33, fontWeight: 700 }}>{row.text}</div>;
    case "option":
      return <div style={{ ...base, fontSize: 26, whiteSpace: "pre" }}>{row.text}</div>;
    case "allergen":
      return (
        <div
          style={{
            ...base,
            fontSize: 25,
            fontWeight: 700,
            paddingLeft: 8,
            borderLeft: "3px solid #000",
            borderRight: "3px solid #000",
            borderTop: row.first ? "3px solid #000" : "0",
            borderBottom: row.last ? "3px solid #000" : "0",
          }}
        >
          {row.text}
        </div>
      );
    case "gap":
      return <div style={base} />;
    case "foot":
      return (
        <div style={{ ...base, justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 20 }}>
            <div style={{ display: "flex" }}>{row.text}</div>
            {row.hasQr && <div style={{ display: "flex" }}>Scan to track your order</div>}
            <div style={{ display: "flex", fontWeight: 700 }}>The Jacket Club SR1</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} width={112} height={112} alt="" />}
        </div>
      );
  }
}

/** Draws one label as a black-and-white PNG, exactly as long as its content. */
export async function labelPng(label: Label, origin: string): Promise<ArrayBuffer> {
  const width = labelWidth();
  const rows = labelRows(label, width);
  const qr = label.token ? await QRCode.toDataURL(`${origin}/order/${label.token}`, { margin: 0, width: 112, errorCorrectionLevel: "M" }) : null;
  const image = new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: LABEL_PAD, backgroundColor: "#fff", color: "#000", fontFamily: "Body" }}>
        {rows.map((row, i) => (
          <Row key={i} row={row} qr={qr} />
        ))}
      </div>
    ),
    { width, height: labelHeight(rows), fonts: await loadFonts() },
  );
  return image.arrayBuffer();
}

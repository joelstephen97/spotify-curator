import { ImageResponse } from "next/og";
import { authedUser } from "@/lib/api-auth";
import { buildWrapped, type WrappedCard } from "@/lib/wrapped";
import { userStore } from "@/lib/store/redis";
import { commas } from "@/lib/format";

export const dynamic = "force-dynamic";

const W = 1080;
const H = 1350;

// Pull a bold TTF for the display type. Satori can't read woff2, so we ask
// Google's CSS for the truetype source. If anything fails we fall back to the
// built-in font — the layout still reads well.
async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`,
      { headers: { "User-Agent": "Mozilla/4.0" } },
    ).then((r) => r.text());
    const url = css.match(
      /src:\s*url\((https:\/\/[^)]+)\)\s*format\('(?:truetype|opentype)'\)/,
    )?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

function poster(card: WrappedCard) {
  const accent = "#34d399";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 72,
        color: "#f4fff9",
        fontFamily: "Display, sans-serif",
        backgroundColor: "#04140d",
        backgroundImage:
          "radial-gradient(60% 45% at 12% 0%, rgba(52,211,153,0.35), transparent 70%), radial-gradient(70% 55% at 100% 100%, rgba(16,185,129,0.28), transparent 70%), linear-gradient(160deg, #05231a, #04140d 70%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 26,
          letterSpacing: 6,
          color: accent,
          textTransform: "uppercase",
        }}
      >
        <span>◗ Soundprint</span>
        <span style={{ color: "#9fe9cc" }}>Year in sound</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
        <span style={{ fontSize: 34, color: "#bdeedd" }}>
          {card.displayName}
        </span>
        <span
          style={{
            fontSize: 230,
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: -6,
            color: accent,
            marginTop: 4,
          }}
        >
          {commas(card.minutes.value)}
        </span>
        <span style={{ fontSize: 40, color: "#dffaef", marginTop: 6 }}>
          {card.minutes.estimated ? "≈ " : ""}
          {card.minutes.label}
        </span>
      </div>

      <div style={{ display: "flex", gap: 28, marginTop: 64 }}>
        <PosterTile
          kicker="Top artist"
          image={card.topArtist.image}
          round={9999}
          primary={card.topArtist.name}
          secondary={card.topArtist.detail}
          accent={accent}
        />
        <PosterTile
          kicker="Top track"
          image={card.topTrack.image}
          round={24}
          primary={card.topTrack.name}
          secondary={card.topTrack.artist}
          accent={accent}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
        <span style={{ fontSize: 30, color: accent, letterSpacing: 2 }}>
          {card.personality.title.toUpperCase()}
        </span>
        <span style={{ fontSize: 34, color: "#eafff7", marginTop: 8 }}>
          {card.topGenre ? `Mostly ${card.topGenre}.` : "Genre nomad."}{" "}
          {card.personality.tagline}
        </span>
        <span
          style={{
            fontSize: 22,
            color: "#6fb39a",
            marginTop: 36,
          }}
        >
          Not affiliated with Spotify · Data via the Spotify API
        </span>
      </div>
    </div>
  );
}

function PosterTile({
  kicker,
  image,
  round,
  primary,
  secondary,
  accent,
}: {
  kicker: string;
  image: string | null;
  round: number;
  primary: string;
  secondary: string;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: 28,
        borderRadius: 28,
        backgroundColor: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(52,211,153,0.25)",
      }}
    >
      <span
        style={{
          fontSize: 22,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {kicker}
      </span>
      <div style={{ display: "flex", alignItems: "center", marginTop: 18 }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            width={108}
            height={108}
            style={{ borderRadius: round, objectFit: "cover" }}
            alt=""
          />
        ) : (
          <div
            style={{
              display: "flex",
              width: 108,
              height: 108,
              borderRadius: round,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />
        )}
      </div>
      <span
        style={{
          fontSize: 40,
          fontWeight: 800,
          marginTop: 18,
          lineHeight: 1.05,
          color: "#ffffff",
        }}
      >
        {primary.length > 22 ? primary.slice(0, 21) + "…" : primary}
      </span>
      {secondary ? (
        <span style={{ fontSize: 26, color: "#a8d8c6", marginTop: 4 }}>
          {secondary}
        </span>
      ) : null}
    </div>
  );
}

export async function GET() {
  let auth;
  try {
    auth = await authedUser();
  } catch {
    return new Response("auth_failed", { status: 401 });
  }
  if (!auth) return new Response("not_connected", { status: 401 });

  const [card, font] = await Promise.all([
    buildWrapped(auth.client, userStore(auth.userId)),
    loadFont("Bricolage+Grotesque", 800),
  ]);

  return new ImageResponse(poster(card), {
    width: W,
    height: H,
    fonts: font
      ? [{ name: "Display", data: font, weight: 800, style: "normal" }]
      : undefined,
    headers: {
      "Content-Disposition": 'inline; filename="soundprint.png"',
    },
  });
}

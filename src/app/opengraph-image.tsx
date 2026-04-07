import { ImageResponse } from "next/og";

export const alt = "Salta — The modern sales platform for hot tub dealers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#010F21",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 100px",
          fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Teal glow accent — top right */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,146,156,0.25) 0%, transparent 70%)",
          }}
        />

        {/* Teal glow accent — bottom left */}
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,146,156,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Salta wordmark */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: "-2px",
            lineHeight: 1,
            marginBottom: 24,
            display: "flex",
          }}
        >
          Salta
        </div>

        {/* Teal accent bar */}
        <div
          style={{
            width: 64,
            height: 5,
            background: "#00929C",
            borderRadius: 3,
            marginBottom: 32,
            display: "flex",
          }}
        />

        {/* Headline */}
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.2,
            maxWidth: 760,
            marginBottom: 32,
            display: "flex",
          }}
        >
          The modern sales platform
          {"\n"}for hot tub dealers
        </div>

        {/* Sub-copy */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 400,
            color: "#94A3B8",
            lineHeight: 1.5,
            maxWidth: 680,
            marginBottom: 48,
            display: "flex",
          }}
        >
          Digital contracts · Instant financing · Real-time analytics
        </div>

        {/* CTA pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#00929C",
            color: "#FFFFFF",
            fontSize: 22,
            fontWeight: 600,
            padding: "14px 32px",
            borderRadius: 12,
          }}
        >
          getsalta.com
        </div>
      </div>
    ),
    { ...size }
  );
}

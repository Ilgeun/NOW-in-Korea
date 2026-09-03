import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoSansKR";

const { fontFamily } = loadFont();

export const FPS = 30;
const SEGMENT_PAD_FRAMES = Math.round(FPS * 0.4); // 세그먼트 사이 짧은 여유
const FALLBACK_SEGMENT_SEC = 3; // 실측 오디오 길이를 모를 때(스튜디오 기본값)의 세그먼트 길이
const OUTRO_SEC = 5; // 아웃트로 최소 길이

// 캔버스(1080x1920) 안에서 각 영역의 높이를 절대좌표로 못박아둔다.
// (flex로 쌓으면 세그먼트별 텍스트 줄 수에 따라 계산이 흔들려서 겹치는 문제가 있었음 — 고정 픽셀이 훨씬 안전함)
const CANVAS_H = 1920;
const HEADER_H = 300;
const SAFE_BOTTOM = Math.round(CANVAS_H * 0.15); // 유튜브 쇼츠 자체 UI가 가리는 하단 15%는 비워둔다
const SUBTITLE_BLOCK_H = 130; // 자막(속보 헤드라인 한 줄) 영역

function segmentFrames(seg) {
  const sec = seg?.durationSec || FALLBACK_SEGMENT_SEC;
  return Math.ceil(sec * FPS) + SEGMENT_PAD_FRAMES;
}

export function computeDurationFrames(trend) {
  const script = trend?.script || [];
  return (
    script.reduce((sum, seg, i) => {
      const isOutro = i === script.length - 1;
      const frames = isOutro ? Math.max(segmentFrames(seg), FPS * OUTRO_SEC) : segmentFrames(seg);
      return sum + frames;
    }, 0) || FPS * 8
  );
}

const COLORS = {
  bg: "#17181a",
  navy: "#0A192F",
  accent: "#4c6fff",
  live: "#ef4444",
  textSub: "#b3b6bc",
  textFaint: "#7a7d84",
};

function fadeUp(frame, startFrame, distance = 20) {
  const local = frame - startFrame;
  const opacity = interpolate(local, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const translateY = interpolate(local, [0, 12], [distance, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity, transform: `translateY(${translateY}px)` };
}

// public/favicon.svg와 동일한 마크(상승 막대 + 라이브 점)를 그대로 재사용한다.
function LogoMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect x="11" y="38" width="9" height="14" rx="2.5" fill="#ffffff" />
      <rect x="24" y="26" width="9" height="26" rx="2.5" fill="#ffffff" />
      <rect x="37" y="14" width="9" height="38" rx="2.5" fill="#ffffff" />
      <circle cx="49" cy="16" r="7" fill={COLORS.live} stroke={COLORS.bg} strokeWidth="2.5" />
    </svg>
  );
}

function Header({ trend }) {
  const frame = useCurrentFrame();
  const tags = Array.isArray(trend.tags) ? trend.tags : [];
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: HEADER_H, padding: "80px 64px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, ...fadeUp(frame, 0) }}>
        <LogoMark size={56} />
        <span style={{ color: "#fff", fontSize: 40, fontWeight: 800 }}>NOW in Korea</span>
        {trend.asOf && <span style={{ color: COLORS.textFaint, fontSize: 26, fontWeight: 600, marginLeft: "auto" }}>{trend.asOf}</span>}
      </div>

      <h1 style={{ color: "#fff", fontSize: 60, fontWeight: 800, lineHeight: 1.22, margin: "26px 0 0", ...fadeUp(frame, 5) }}>
        {trend.topic}
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 16, ...fadeUp(frame, 9) }}>
        {trend.category && (
          <span
            style={{
              background: "rgba(76,111,255,0.18)",
              color: "#a8b6ff",
              fontSize: 24,
              fontWeight: 700,
              padding: "6px 16px",
              borderRadius: 999,
            }}
          >
            {trend.category}
          </span>
        )}
        {tags.map((tag) => (
          <span key={tag} style={{ color: COLORS.textSub, fontSize: 26, fontWeight: 700 }}>
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// 자막: [속보] 배지 + 헤드라인 한 줄만 크게 보여준다 (나레이션 원문 줄은 제거).
function SubtitleBlock({ seg }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: SAFE_BOTTOM, height: SUBTITLE_BLOCK_H, display: "flex", alignItems: "stretch" }}>
      <div
        style={{
          background: COLORS.live,
          color: "#fff",
          fontSize: 34,
          fontWeight: 800,
          padding: "0 30px",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        속보
      </div>
      <div
        style={{
          flex: 1,
          background: "rgba(0,0,0,0.68)",
          color: "#fff",
          fontSize: 42,
          fontWeight: 800,
          lineHeight: 1.25,
          padding: "0 28px",
          display: "flex",
          alignItems: "center",
        }}
      >
        {seg.caption}
      </div>
    </div>
  );
}

function ContentSegment({ seg }) {
  const frame = useCurrentFrame();
  const imageTop = HEADER_H;
  const imageBottom = SAFE_BOTTOM + SUBTITLE_BLOCK_H;

  return (
    <AbsoluteFill>
      {seg.audioFile && <Audio src={staticFile(seg.audioFile)} />}

      {seg.imageFile && (
        <div
          style={{
            position: "absolute",
            top: imageTop + 24,
            bottom: imageBottom + 24,
            left: 64,
            right: 64,
            borderRadius: 24,
            overflow: "hidden",
            ...fadeUp(frame, 0, 12),
          }}
        >
          <Img
            src={staticFile(seg.imageFile)}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
          />
          <div
            style={{
              position: "absolute",
              left: 16,
              bottom: 16,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 22,
              fontWeight: 700,
              padding: "8px 16px",
              borderRadius: 999,
            }}
          >
            AI 생성 이미지 · 자료화면
          </div>
        </div>
      )}

      <SubtitleBlock seg={seg} />
    </AbsoluteFill>
  );
}

// 아웃트로: 딥 네이비 배경 + 은은한 궤도 그래픽 + 중앙 흰색 CTA 카드.
function OutroSegment({ seg }) {
  const frame = useCurrentFrame();
  const rotation = interpolate(frame, [0, FPS * OUTRO_SEC], [0, 40]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.navy, alignItems: "center", justifyContent: "center" }}>
      {seg.audioFile && <Audio src={staticFile(seg.audioFile)} />}

      {/* 은은한 궤도 그래픽 모션 */}
      <div style={{ position: "absolute", width: 640, height: 640, transform: `rotate(${rotation}deg)` }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${COLORS.accent}`,
            opacity: 0.25,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 70,
            borderRadius: "50%",
            border: `2px solid ${COLORS.accent}`,
            opacity: 0.18,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: COLORS.accent,
            transform: "translateX(-50%)",
          }}
        />
      </div>

      {/* 중앙 CTA 카드 */}
      <div
        style={{
          position: "relative",
          width: 780,
          background: "#ffffff",
          borderRadius: 28,
          padding: "56px 48px",
          textAlign: "center",
          ...fadeUp(frame, 6, 16),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 28 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: COLORS.navy,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogoMark size={28} />
          </div>
          <span style={{ color: COLORS.navy, fontSize: 32, fontWeight: 800 }}>NOW in Korea</span>
        </div>
        <p style={{ color: "#20222a", fontSize: 34, fontWeight: 700, lineHeight: 1.5, margin: 0 }}>
          더 자세한 이슈 지수는
          <br />
          NOW in Korea에서 확인하세요
        </p>
        <div
          style={{
            marginTop: 32,
            display: "inline-block",
            background: COLORS.accent,
            color: "#fff",
            fontSize: 26,
            fontWeight: 800,
            padding: "16px 36px",
            borderRadius: 999,
          }}
        >
          지금 확인하기
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function TrendShort({ trend }) {
  const script = trend.script || [];
  const contentSegments = script.slice(0, -1);
  const outroSeg = script[script.length - 1];

  let offset = 0;
  const contentSequences = contentSegments.map((seg, i) => {
    const duration = segmentFrames(seg);
    const from = offset;
    offset += duration;
    return (
      <Sequence key={i} from={from} durationInFrames={duration}>
        <ContentSegment seg={seg} />
      </Sequence>
    );
  });
  const contentDuration = offset;
  const outroDuration = outroSeg ? Math.max(segmentFrames(outroSeg), FPS * OUTRO_SEC) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily }}>
      {/* 헤더(로고+키워드+해시태그)는 뉴스 구간에서만 보이고, 아웃트로에서는 완전히 사라진다 */}
      <Sequence from={0} durationInFrames={contentDuration}>
        <Header trend={trend} />
        {contentSequences}
      </Sequence>
      {outroSeg && (
        <Sequence from={contentDuration} durationInFrames={outroDuration}>
          <OutroSegment seg={outroSeg} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

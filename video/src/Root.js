import { Composition } from "remotion";
import { TrendShort, FPS, computeDurationFrames } from "./TrendShort";

// 이 파일은 브라우저(크롬 헤드리스)에서 번들링/실행되므로 Node의 fs를 쓸 수 없다.
// 실제 렌더링은 render-all.js가 트렌드마다 이 컴포지션에 다른 trend 하나씩을
// inputProps로 넘겨 개별 영상 파일로 뽑아낸다. 여기 있는 값은 Remotion Studio
// 미리보기용 기본값일 뿐이다.
const FALLBACK_TREND = {
  rank: 1,
  keyword: "샘플 키워드",
  topic: "샘플 키워드",
  category: "IT/과학",
  script: [
    { caption: "지금 왜 화제일까?" },
    { caption: "npm run generate-script" },
    { caption: "실제 데이터로 확인해보세요" },
  ],
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="TrendShort"
      component={TrendShort}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={computeDurationFrames(FALLBACK_TREND)}
      defaultProps={{ trend: FALLBACK_TREND }}
      calculateMetadata={({ props }) => ({
        durationInFrames: computeDurationFrames(props.trend),
      })}
    />
  );
};

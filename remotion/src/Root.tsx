import { Composition } from "remotion";
import { FinalCutVideo } from "./Video";
import { finalCutSchema, FinalCutProps } from "./schema";
import exampleProps from "../props.example.json";

/**
 * 只註冊一個 composition「FinalCut」。
 * 影片的尺寸/長度/fps 都從 props 動態決定(calculateMetadata),
 * 所以同一個 composition 能套用到任何來源影片。
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FinalCut"
      component={FinalCutVideo}
      schema={finalCutSchema}
      // 下面這些是預設值,實際會被 calculateMetadata 依 props 覆寫
      durationInFrames={300}
      fps={30}
      width={1280}
      height={720}
      defaultProps={exampleProps as FinalCutProps}
      calculateMetadata={({ props }) => {
        const fps = props.fps ?? 30;
        return {
          fps,
          width: props.width ?? 1280,
          height: props.height ?? 720,
          durationInFrames: Math.max(
            1,
            Math.ceil((props.durationInSeconds ?? 10) * fps)
          ),
        };
      }}
    />
  );
};

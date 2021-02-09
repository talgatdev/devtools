import React from "react";
import { connect, ConnectedProps } from "react-redux";
import { actions } from "ui/actions";
import { setActiveComment } from "ui/actions/comments";
import { selectors } from "ui/reducers";
import { UIState } from "ui/state";
import Marker from "./Marker";
import "./MessageMarker.css";

function MessageMarker({
  message,
  currentTime,
  hoveredPoint,
  zoomRegion,
  overlayWidth,
  setActiveComment,
}: MessageMarkerProps) {
  const { executionPoint, executionPointTime, frame, pauseId, executionPointHasFrames } = message;

  return (
    <Marker
      point={executionPoint}
      time={executionPointTime}
      hasFrames={executionPointHasFrames}
      location={frame}
      pauseId={pauseId}
      currentTime={currentTime}
      hoveredPoint={hoveredPoint}
      zoomRegion={zoomRegion}
      overlayWidth={overlayWidth}
      onSeek={() => setActiveComment(message)}
    />
  );
}

const connector = connect(
  (state: UIState) => ({
    zoomRegion: selectors.getZoomRegion(state),
    currentTime: selectors.getCurrentTime(state),
    hoveredPoint: selectors.getHoveredPoint(state),
    overlayWidth: selectors.getTimelineDimensions(state).width,
  }),
  {
    setActiveComment: actions.setActiveComment,
  }
);

type PropsFromRedux = ConnectedProps<typeof connector>;
type MessageMarkerProps = PropsFromRedux & {
  message: any;
};

export default connector(MessageMarker);

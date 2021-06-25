import React, { useEffect } from "react";
import { connect } from "react-redux";
import { actions } from "ui/actions";
import { installObserver, refreshGraphics, Video as VideoPlayer } from "../../protocol/graphics";
import { selectors } from "../reducers";
import CommentsOverlay from "ui/components/Comments/VideoComments/index";
import CommentTool from "ui/components/shared/CommentTool";
import hooks from "ui/hooks";
import { useAuth0 } from "@auth0/auth0-react";

function CommentLoader({ recordingId }) {
  const { comments, loading } = hooks.useGetComments(recordingId);

  if (loading) {
    return null;
  }

  return <CommentTool comments={comments} />;
}

function Video({
  recordingId,
  currentTime,
  playback,
  isNodePickerActive,
  pendingComment,
  recordingTarget,
  setVideoNode,
  videoUrl,
}) {
  const { isAuthenticated } = useAuth0();
  const isPaused = !playback;
  const isNodeTarget = recordingTarget == "node";

  useEffect(() => {
    installObserver();
  }, []);

  // Seek and resume playback if playing when swapping between Viewer and DevTools
  useEffect(() => {
    if (playback) {
      refreshGraphics();
      VideoPlayer.seek(currentTime);
      VideoPlayer.play();
    }
  }, []);

  // This is intentionally mousedown. Otherwise, the NodePicker's mouseup callback fires
  // first. This updates the isNodePickerActive value and makes it look like the node picker is
  // inactive when we check it here.
  const onMouseDown = () => {
    if (isNodePickerActive || pendingComment) {
      return;
    }
  };

  const showCommentTool = isPaused && !isNodeTarget && isAuthenticated && !isNodePickerActive;

  return (
    <div id="video">
      <video id="graphicsVideo" src={videoUrl} ref={setVideoNode} />
      <canvas id="graphics" onMouseDown={onMouseDown} />
      {showCommentTool ? (
        <CommentsOverlay>
          <CommentLoader recordingId={recordingId} />
        </CommentsOverlay>
      ) : null}
      <div id="highlighter-root"></div>
    </div>
  );
}

export default connect(
  state => ({
    pendingComment: selectors.getPendingComment(state),
    isNodePickerActive: selectors.getIsNodePickerActive(state),
    currentTime: selectors.getCurrentTime(state),
    playback: selectors.getPlayback(state),
    recordingTarget: selectors.getRecordingTarget(state),
    recordingId: selectors.getRecordingId(state),
    videoUrl: selectors.getVideoUrl(state),
  }),
  {
    setVideoNode: actions.setVideoNode,
    togglePlayback: actions.togglePlayback,
    clearPendingComment: actions.clearPendingComment,
  }
)(Video);

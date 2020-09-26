import React from "react";
import { connect } from "react-redux";

import Toolbox from "./Toolbox";
import Comments from "./Comments";
import Recordings from "./Recordings/index";
import Header from "./Header";
import Viewer from "./Viewer";
import Loader from "./shared/Loader";
import { UserPrompt } from "./Account/index";
import SplitBox from "devtools/client/shared/components/splitter/SplitBox";
import RecordingLoadingScreen from "./RecordingLoadingScreen";

import { actions } from "../actions";
import { selectors } from "../reducers";
import { screenshotCache, nextPaintEvent, getClosestPaintPoint } from "protocol/graphics";

function DevtoolsSplitBox({ updateTimelineDimensions, tooltip }) {
  const toolbox = <Toolbox />;
  const viewer = <Viewer tooltip={tooltip} />;

  return (
    <SplitBox
      style={{ width: "100vw", overflow: "hidden" }}
      splitterSize={1}
      initialSize="50%"
      minSize="20%"
      maxSize="80%"
      vert={false}
      onMove={num => updateTimelineDimensions()}
      startPanel={viewer}
      endPanel={toolbox}
      endPanelControl={false}
    />
  );
}

export class DevTools extends React.Component {
  render() {
    const {
      unfocusComment,
      loading,
      tooltip,
      hasFocusedComment,
      updateTimelineDimensions,
      recordingDuration,
      sessionId,
    } = this.props;
    const isRecordingUploaded = sessionId !== null;
    const isRecordingFetchedFromServer = recordingDuration !== null;
    const isRecordingLoading = loading < 100;

    if (!isRecordingFetchedFromServer || !isRecordingUploaded) {
      return <Loader />;
    } else if (isRecordingLoading) {
      return <RecordingLoadingScreen />;
    }

    return (
      <>
        <Header />
        <Comments />
        {hasFocusedComment && <div className="app-mask" onClick={unfocusComment} />}
        <DevtoolsSplitBox tooltip={tooltip} updateTimelineDimensions={updateTimelineDimensions} />
      </>
    );
  }
}

export default connect(
  state => ({
    loading: selectors.getLoading(state),
    tooltip: selectors.getTooltip(state),
    hasFocusedComment: selectors.hasFocusedComment(state),
    recordingDuration: selectors.getRecordingDuration(state),
    sessionId: selectors.getSessionId(state),
  }),
  {
    updateTimelineDimensions: actions.updateTimelineDimensions,
    unfocusComment: actions.unfocusComment,
  }
)(DevTools);

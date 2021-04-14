import React, { useEffect } from "react";
import { connect, ConnectedProps } from "react-redux";
import { selectors } from "ui/reducers";
import { actions } from "ui/actions";
import sortBy from "lodash/sortBy";
import hooks from "ui/hooks";
import { getUserId } from "ui/utils/useToken";
import { isTest } from "ui/utils/environment";

import TranscriptFilter from "ui/components/Transcript/TranscriptFilter";
import {
  EventTranscriptItem,
  NonEventTranscriptItem,
  FloatingTranscriptItem,
} from "./TranscriptItem";
import "./Transcript.css";
import DraftScreen from "../DraftScreen";

import { UIState } from "ui/state";
import { Event, Comment, FloatingItem } from "ui/state/comments";

type Entry = Comment | Event;

function createEntries(comments: Comment[], clickEvents: Event[], shouldShowLoneEvents: boolean) {
  let entries = clickEvents.map(event => ({ ...event }));

  let nonNestedComments = comments.reduce((acc: Comment[], comment: Comment) => {
    const matchingEntryIndex = entries.findIndex(entry => entry.point == comment.point);
    if (matchingEntryIndex >= 0) {
      entries[matchingEntryIndex].comment = comment;
      return acc;
    } else {
      return [...acc, comment];
    }
  }, []);

  // If lone events are supposed to be hidden, filter them out.
  if (!shouldShowLoneEvents) {
    entries = entries.filter(entry => entry.comment);
  }

  return [...entries, ...nonNestedComments];
}

function Transcript({
  clickEvents,
  currentTime,
  playback,
  recordingId,
  shouldShowLoneEvents,
  floatingItem,
  showFloatingItem,
  hideFloatingItem,
}: PropsFromRedux) {
  const { comments } = hooks.useGetComments(recordingId!);
  const { recording, loading } = hooks.useGetRecording(recordingId!);
  const userId = getUserId();
  const isAuthor = userId && userId == recording?.user_id;

  const entries: Entry[] = createEntries(comments, clickEvents, shouldShowLoneEvents);

  useEffect(
    function updateFloatingItem() {
      const isPlaying = playback;
      const isFloatingPause = !entries.some(entry => entry.time == currentTime);

      if (isFloatingPause && !isPlaying) {
        showFloatingItem();
      } else {
        hideFloatingItem();
      }
    },
    [currentTime, comments]
  );

  if (loading) {
    return null;
  }

  const displayedEntries: (Entry | FloatingItem)[] = [...entries];

  if (floatingItem) {
    displayedEntries.push(floatingItem);
  }

  // Only show the initialization screen if the replay is not being opened
  // for testing purposes.
  if (isAuthor && !recording.is_initialized && !isTest()) {
    return <DraftScreen />;
  }

  return (
    <div className="right-sidebar">
      <div className="right-sidebar-toolbar">
        <div className="right-sidebar-toolbar-item">Transcript</div>
        <TranscriptFilter />
      </div>
      <div className="transcript-panel">
        <div className="transcript-list">
          {sortBy(displayedEntries, ["time", "kind", "created_at"]).map((entry, i) => {
            if ("itemType" in entry) {
              return <FloatingTranscriptItem item={entry} key={i} />;
            } else if ("content" in entry) {
              return <NonEventTranscriptItem comment={entry} key={i} />;
            } else {
              return <EventTranscriptItem event={entry} key={i} />;
            }
          })}
        </div>
      </div>
    </div>
  );
}

const connector = connect(
  (state: UIState) => ({
    playback: selectors.getPlayback(state),
    currentTime: selectors.getCurrentTime(state),
    recordingId: selectors.getRecordingId(state),
    clickEvents: selectors.getEventsForType(state, "mousedown"),
    pendingComment: selectors.getPendingComment(state),
    shouldShowLoneEvents: selectors.getShouldShowLoneEvents(state),
    floatingItem: selectors.getFloatingItem(state),
  }),
  {
    showFloatingItem: actions.showFloatingItem,
    hideFloatingItem: actions.hideFloatingItem,
  }
);
type PropsFromRedux = ConnectedProps<typeof connector>;
export default connector(Transcript);

import React, { useState } from "react";
import { connect } from "react-redux";

import Timeline from "../Timeline";
import Video from "../Video";
import Toolbar from "../Toolbar";
import SplitBox from "devtools/client/shared/components/splitter/SplitBox";
import SidePanel from "ui/components/SidePanel";
import EventListeners from "devtools/client/debugger/src/components/SecondaryPanes/EventListeners";
import Dropdown from "ui/components/shared/Dropdown";

import { updateTimelineDimensions } from "../../actions/timeline";
import { prefs } from "../../utils/prefs";
import { selectors } from "../../reducers";
import "./NonDevView.css";

export function EventsFilter() {
  const [expanded, setExpanded] = useState(TextTrackCueList);

  const buttonContent = <div className="img settings" />;

  return (
    <div className="event-breakpoints">
      <Dropdown
        buttonContent={buttonContent}
        setExpanded={setExpanded}
        expanded={expanded}
        buttonStyle={"secondary"}
      >
        <EventListeners />
      </Dropdown>
    </div>
  );
}

function NonDevView({ updateTimelineDimensions, narrowMode, selectedPrimaryPanel }) {
  const viewer = (
    <div className="vertical-panels">
      <Video />
      <div id="timeline-container">
        <Timeline />
      </div>
    </div>
  );

  const handleMove = num => {
    updateTimelineDimensions();
    prefs.nonDevSidePanelWidth = `${num}px`;
  };

  if (narrowMode) {
    return (
      <>
        <SplitBox
          style={{ width: "100%", overflow: "hidden" }}
          splitterSize={1}
          initialSize={prefs.nonDevSidePanelWidth}
          minSize="20%"
          onMove={handleMove}
          maxSize="80%"
          vert={false}
          startPanel={<Video />}
          endPanel={<SidePanel />}
          endPanelControl={false}
        />
        <div id="timeline-container">
          <Timeline />
        </div>
      </>
    );
  }

  return (
    <SplitBox
      style={{ width: "100%", overflow: "hidden" }}
      splitterSize={1}
      initialSize={prefs.nonDevSidePanelWidth}
      minSize="20%"
      onMove={handleMove}
      maxSize="80%"
      vert={true}
      startPanel={
        <div className="horizontal-panels">
          <Toolbar />
          <SidePanel />
        </div>
      }
      endPanel={viewer}
      endPanelControl={false}
    />
  );
}

export default connect(
  state => ({
    narrowMode: selectors.getNarrowMode(state),
    selectedPrimaryPanel: selectors.getSelectedPrimaryPanel(state),
  }),
  {
    updateTimelineDimensions,
  }
)(NonDevView);

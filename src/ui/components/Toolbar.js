import React from "react";
import classnames from "classnames";
import { connect } from "react-redux";
import { actions } from "../actions";
import { selectors } from "../reducers";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import IconWithTooltip from "ui/components/shared/IconWithTooltip";
import MaterialIcon from "ui/components/shared/MaterialIcon";

function IndexingLoader({ loadedRegions }) {
  const { loaded, loading } = loadedRegions;

  if (!loaded[0] || !loading[0]) {
    return null;
  }

  const progressPercentage =
    (loaded[0].end - loaded[0].begin) / (loading[0].end - loading[0].begin);

  return (
    <div className="w-8 h-8" title={`Indexing (${(progressPercentage * 100).toFixed()}%)`}>
      <CircularProgressbar
        value={progressPercentage * 100}
        strokeWidth={10}
        styles={buildStyles({ pathColor: `#353535`, trailColor: `#ECECED` })}
      />
    </div>
  );
}

function Toolbar({
  selectedPrimaryPanel,
  setSelectedPrimaryPanel,
  togglePaneCollapse,
  panelCollapsed,
  loadedRegions,
  isPaused,
  viewMode,
}) {
  const onClick = panel => {
    if (panelCollapsed || (selectedPrimaryPanel == panel && !panelCollapsed)) {
      togglePaneCollapse();
    }

    if (selectedPrimaryPanel != panel) {
      setSelectedPrimaryPanel(panel);
    }
  };

  return (
    <div className="toolbox-toolbar-container flex flex-col items-center justify-between p-2 pb-6">
      <div id="toolbox-toolbar">
        <div
          className={classnames("toolbar-panel-button", {
            active: selectedPrimaryPanel == "comments",
          })}
        >
          <IconWithTooltip
            icon={<MaterialIcon className="forum toolbar-panel-icon">forum</MaterialIcon>}
            content={"Comments"}
            handleClick={() => onClick("comments")}
          />
        </div>

        {viewMode == "dev" ? (
          <>
            <div
              className={classnames("toolbar-panel-button", {
                active: selectedPrimaryPanel == "explorer",
              })}
            >
              <IconWithTooltip
                icon={
                  <MaterialIcon className="description toolbar-panel-icon">
                    description
                  </MaterialIcon>
                }
                content={"Source Explorer"}
                handleClick={() => onClick("explorer")}
              />
            </div>
            <div
              className={classnames("toolbar-panel-button", {
                active: selectedPrimaryPanel == "debug",
              })}
            >
              <IconWithTooltip
                icon={
                  <MaterialIcon className="motion_photos_paused toolbar-panel-icon">
                    motion_photos_paused
                  </MaterialIcon>
                }
                content={"Pause Information"}
                handleClick={() => onClick("debug")}
              />
            </div>
          </>
        ) : null}
      </div>
      <IndexingLoader {...{ loadedRegions }} />
    </div>
  );
}

export default connect(
  state => ({
    initializedPanels: selectors.getInitializedPanels(state),
    panelCollapsed: selectors.getPaneCollapse(state),
    selectedPrimaryPanel: selectors.getSelectedPrimaryPanel(state),
    selectedPanel: selectors.getSelectedPanel(state),
    loadedRegions: selectors.getLoadedRegions(state),
    isPaused: selectors.getFrames(state)?.length > 0,
    viewMode: selectors.getViewMode(state),
  }),
  {
    setSelectedPrimaryPanel: actions.setSelectedPrimaryPanel,
    togglePaneCollapse: actions.togglePaneCollapse,
  }
)(Toolbar);

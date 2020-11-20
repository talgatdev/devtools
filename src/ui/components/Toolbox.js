import React from "react";
import classnames from "classnames";
import KeyShortcuts from "devtools/client/shared/key-shortcuts";
import SplitBox from "devtools/client/shared/components/splitter/SplitBox";

import DebuggerApp from "devtools/client/debugger/src/components/App";
import InspectorApp from "devtools/client/inspector/components/App";
import WebConsoleApp from "devtools/client/webconsole/components/App";

import Timeline from "./Timeline";
import NodePicker from "./NodePicker";
import { connect } from "react-redux";
import { actions } from "../actions";
import { selectors } from "../reducers";

import "./Toolbox.css";

const shortcuts = new KeyShortcuts({ window, target: document });

class Toolbox extends React.Component {
  async componentDidMount() {
    const { selectedPanel } = this.props;
    await gToolbox.init(selectedPanel);

    shortcuts.on("Esc", this.onEscape);
  }

  get currentTool() {
    return this.props.selectedPanel;
  }

  onEscape = e => {
    if (e.cancelBubble) {
      return;
    }

    this.toggleSplitConsole(!this.props.splitConsoleOpen);
  };

  toggleSplitConsole(open) {
    this.props.setSplitConsole(open);
  }

  renderInspector() {
    const { initializedPanels } = this.props;
    const inspector = gToolbox.getPanel("inspector");
    let markupView, rulesPanel, layoutPanel, computedPanel;

    if (inspector && initializedPanels.includes("inspector")) {
      markupView = inspector._inspector.getPanel("markupview").provider;
      rulesPanel = {
        id: "ruleview",
        title: "Rules",
        panel: inspector._inspector.getPanel("ruleview").provider,
      };
      layoutPanel = {
        id: "layoutview",
        title: "Layout",
        panel: inspector._inspector.getPanel("layoutview").provider,
      };
      computedPanel = {
        id: "computedview",
        title: "Computed",
        panel: inspector._inspector.getPanel("computedview").provider,
      };
    }
    return (
      <>
        <InspectorApp
          markupView={markupView}
          rulesPanel={rulesPanel}
          layoutPanel={layoutPanel}
          computedPanel={computedPanel}
        />
        <div id="tabpanels" style={{ display: "none" }}>
          <div id="sidebar-panel-computedview" className="theme-sidebar inspector-tabpanel">
            <div id="computed-toolbar" className="devtools-toolbar devtools-input-toolbar">
              <div className="devtools-searchbox">
                <input
                  id="computed-searchbox"
                  className="devtools-filterinput"
                  type="search"
                  data-localization="placeholder=inspector.filterStyles.placeholder"
                />
                <button
                  id="computed-searchinput-clear"
                  className="devtools-searchinput-clear"
                ></button>
              </div>
              <div className="devtools-separator"></div>
              <input id="browser-style-checkbox" type="checkbox" className="includebrowserstyles" />
              <label
                id="browser-style-checkbox-label"
                htmlFor="browser-style-checkbox"
                data-localization="content=inspector.browserStyles.label"
              ></label>
            </div>

            <div id="computed-container">
              <div id="computed-container-focusable" tabIndex="-1">
                <div
                  id="computed-property-container"
                  className="devtools-monospace"
                  tabIndex="0"
                  dir="ltr"
                ></div>
                <div
                  id="computed-no-results"
                  className="devtools-sidepanel-no-result"
                  hidden=""
                  data-localization="content=inspector.noProperties"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  renderToolbar() {
    const { selectedPanel } = this.props;

    return (
      <div id="toolbox-toolbar">
        <NodePicker />
        <div
          className={classnames("toolbar-panel-button", {
            active: selectedPanel == "inspector",
          })}
          id="toolbox-toolbar-inspector"
          onClick={() => gToolbox.selectTool("inspector")}
        >
          <div className="toolbar-panel-icon"></div>
          Elements
        </div>
        <div
          className={classnames("toolbar-panel-button", {
            active: selectedPanel == "debugger",
          })}
          id="toolbox-toolbar-debugger"
          onClick={() => gToolbox.selectTool("debugger")}
        >
          <div className="toolbar-panel-icon"></div>
          Sources
        </div>
        <div
          className={classnames("toolbar-panel-button", {
            active: selectedPanel == "console",
          })}
          id="toolbox-toolbar-console"
          onClick={() => gToolbox.selectTool("console")}
        >
          <div className="toolbar-panel-icon"></div>
          Console
        </div>
      </div>
    );
  }

  getSplitBoxDimensions() {
    const { selectedPanel, splitConsoleOpen } = this.props;

    if (selectedPanel == "console") {
      // We intentionally don't pass in the `initialSize: "0%"` here. This is
      // important for when the split console is open, and we switch panels from
      // uncontrolled (console) to controlled (debugger/inspector). This way, the
      // controlled height is not stuck at 0% until we resize the panel manually.
      return {
        minSize: 0,
        maxSize: 0,
      };
    }

    if (splitConsoleOpen) {
      return {
        initialSize: "50%",
        minSize: "0%",
        maxSize: "100%",
      };
    }

    return {
      initialSize: "50%",
      minSize: "100%",
      maxSize: "100%",
    };
  }

  render() {
    const { selectedPanel, splitConsoleOpen } = this.props;
    return (
      <div id="toolbox" className={`${selectedPanel}`}>
        <div id="toolbox-timeline">
          <Timeline />
        </div>
        {this.renderToolbar()}
        {this.props.toolboxExpanded && (
          <div
            id="toolbox-contents"
            className={classnames("", {
              splitConsole: selectedPanel != "console" && splitConsoleOpen,
            })}
          >
            <SplitBox
              style={{ width: "100vw", overflow: "hidden" }}
              {...this.getSplitBoxDimensions()}
              splitterSize={1}
              vert={false}
              onResizeEnd={num => {}}
              startPanel={
                <div className="toolbox-top-panels">
                  <div
                    className={classnames("toolbox-panel", {
                      active: selectedPanel == "debugger",
                    })}
                    id="toolbox-content-debugger"
                  >
                    <DebuggerApp />
                  </div>
                  <div
                    className={classnames("toolbox-panel theme-body", {
                      active: selectedPanel == "inspector",
                    })}
                    id="toolbox-content-inspector"
                  >
                    {this.renderInspector()}
                  </div>
                </div>
              }
              endPanelControl={false}
              endPanel={
                <div className="toolbox-bottom-panels" style={{ overflow: "hidden" }}>
                  <div
                    className={classnames("toolbox-panel", {
                      active: selectedPanel == "console" || splitConsoleOpen,
                    })}
                    id="toolbox-content-console"
                  >
                    <WebConsoleApp />
                  </div>
                </div>
              }
            />
          </div>
        )}
      </div>
    );
  }
}
export default connect(
  state => ({
    initializedPanels: selectors.getInitializedPanels(state),
    selectedPanel: selectors.getSelectedPanel(state),
    splitConsoleOpen: selectors.isSplitConsoleOpen(state),
    toolboxExpanded: selectors.getToolboxExpanded(state),
  }),
  {
    setSplitConsole: actions.setSplitConsole,
    setSelectedPanel: actions.setSelectedPanel,
  }
)(Toolbox);

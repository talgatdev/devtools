/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

import React, { PureComponent } from "react";
import ReactDOM from "react-dom";
import { connect } from "../../utils/connect";

import { getSelectedSource, getSourcesForTabs, getIsPaused, getContext } from "../../selectors";
import { isVisible } from "../../utils/ui";

import { getHiddenTabs, getLastVisibleTab, getSelectedSourceIsVisible } from "../../utils/tabs";
import { getFilename, isPretty, getFileURL } from "../../utils/source";
import actions from "../../actions";

import { debounce } from "lodash";
import "./Tabs.css";

import Tab from "./Tab";
import PortalDropdown from "ui/components/shared/PortalDropdown";
import AccessibleImage from "../shared/AccessibleImage";
import CommandBar from "../SecondaryPanes/CommandBar";

function haveTabSourcesChanged(tabSources, prevTabSources) {
  if (tabSources.length !== prevTabSources.length) {
    return true;
  }

  for (let i = 0; i < tabSources.length; ++i) {
    if (tabSources[i].id !== prevTabSources[i].id) {
      return true;
    }
  }

  return false;
}

class Tabs extends PureComponent {
  onTabContextMenu;
  showContextMenu;
  updateHiddenTabs;
  toggleSourcesDropdown;
  renderDropdownSource;
  renderTabs;
  renderDropDown;
  renderStartPanelToggleButton;
  onResize;
  _draggedSource;
  _draggedSourceIndex;

  constructor(props) {
    super(props);
    this.state = {
      dropdownShown: false,
      hiddenTabs: [],
    };

    this.onResize = debounce(() => {
      this.updateHiddenTabs();
    });
  }

  get draggedSource() {
    return this._draggedSource == null ? { url: null, id: null } : this._draggedSource;
  }

  set draggedSource(source) {
    this._draggedSource = source;
  }

  get draggedSourceIndex() {
    return this._draggedSourceIndex == null ? -1 : this._draggedSourceIndex;
  }

  set draggedSourceIndex(index) {
    this._draggedSourceIndex = index;
  }

  componentDidUpdate(prevProps) {
    const { selectedSource, tabSources } = this.props;
    if (
      selectedSource !== prevProps.selectedSource ||
      haveTabSourcesChanged(tabSources, prevProps.tabSources)
    ) {
      this.updateHiddenTabs();
    }

    // Newly-selected sources are added to the end of the tabs order. This becomes a problem
    // if we have hidden tabs, because the source text would be shown but the tab is hidden.
    // This makes sure that in cases where we have hidden tabs, we add the newly-selected source
    // so that it's the last visible tab to the right.
    if (selectedSource && selectedSource !== prevProps.selectedSource) {
      this.ensureSelectedSourceIsVisible();
    }
  }

  componentDidMount() {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(this.updateHiddenTabs);
    }

    window.addEventListener("resize", this.onResize);
    document.querySelector(".editor-pane").addEventListener("resizeend", this.onResize);
  }

  componentWillUnmount() {
    document.removeEventListener("resize", this.onResize);

    document.querySelector(".editor-pane").removeEventListener("resizeend", this.onResize);
  }

  ensureSelectedSourceIsVisible() {
    const { selectedSource, moveTabBySourceId } = this.props;
    const sourceTabEls = this.refs.sourceTabs.children;

    if (getSelectedSourceIsVisible(sourceTabEls)) {
      return;
    }

    const lastVisibleTab = getLastVisibleTab(sourceTabEls);
    const lastVisibleTabIndex = [...sourceTabEls].findIndex(elem => elem === lastVisibleTab);

    // Place the newly-selected source right before the last visible tab. This way, the last visible
    // tab in the editor tabs becomes the newly-selected source.
    moveTabBySourceId(selectedSource.id, lastVisibleTabIndex);
  }

  /*
   * Updates the hiddenSourceTabs state, by
   * finding the source tabs which are wrapped and are not on the top row.
   */
  updateHiddenTabs = () => {
    if (!this.refs.sourceTabs) {
      return;
    }
    const { selectedSource, tabSources, moveTab } = this.props;
    const sourceTabEls = this.refs.sourceTabs.children;
    const hiddenTabs = getHiddenTabs(tabSources, sourceTabEls);

    if (selectedSource && isVisible() && hiddenTabs.find(tab => tab.id == selectedSource.id)) {
      return moveTab(selectedSource.url, 0);
    }

    this.setState({ hiddenTabs });
  };

  toggleSourcesDropdown() {
    this.setState(prevState => ({
      dropdownShown: !prevState.dropdownShown,
    }));
  }

  setSourcesDropdownShown = dropdownShown => {
    this.setState(() => ({
      dropdownShown,
    }));
  };

  getIconClass(source) {
    if (isPretty(source)) {
      return "prettyPrint";
    }
    if (source.isBlackBoxed) {
      return "blackBox";
    }
    return "file";
  }

  renderDropdownSource = source => {
    const { cx, selectSource } = this.props;
    const filename = getFilename(source);

    const onClick = () => {
      this.setState({ dropdownShown: false });
      selectSource(cx, source.id);
    };

    return (
      <li key={source.id} onClick={onClick} title={getFileURL(source, false)}>
        <AccessibleImage className={`dropdown-icon ${this.getIconClass(source)}`} />
        <span className="dropdown-label">{filename}</span>
      </li>
    );
  };

  onTabDragStart = (source, index) => {
    this.draggedSource = source;
    this.draggedSourceIndex = index;
  };

  onTabDragEnd = () => {
    this.draggedSource = null;
    this.draggedSourceIndex = null;
  };

  onTabDragOver = (e, source, hoveredTabIndex) => {
    const { moveTabBySourceId } = this.props;
    if (hoveredTabIndex === this.draggedSourceIndex) {
      return;
    }

    const tabDOM = ReactDOM.findDOMNode(this.refs[`tab_${source.id}`].getWrappedInstance());

    /* $FlowIgnore: tabDOM.nodeType will always be of Node.ELEMENT_NODE since it comes from a ref;
      however; the return type of findDOMNode is null | Element | Text */
    const tabDOMRect = tabDOM.getBoundingClientRect();
    const { pageX: mouseCursorX } = e;
    if (
      /* Case: the mouse cursor moves into the left half of any target tab */
      mouseCursorX - tabDOMRect.left <
      tabDOMRect.width / 2
    ) {
      // The current tab goes to the left of the target tab
      const targetTab =
        hoveredTabIndex > this.draggedSourceIndex ? hoveredTabIndex - 1 : hoveredTabIndex;
      moveTabBySourceId(this.draggedSource.id, targetTab);
      this.draggedSourceIndex = targetTab;
    } else if (
      /* Case: the mouse cursor moves into the right half of any target tab */
      mouseCursorX - tabDOMRect.left >=
      tabDOMRect.width / 2
    ) {
      // The current tab goes to the right of the target tab
      const targetTab =
        hoveredTabIndex < this.draggedSourceIndex ? hoveredTabIndex + 1 : hoveredTabIndex;
      moveTabBySourceId(this.draggedSource.id, targetTab);
      this.draggedSourceIndex = targetTab;
    }
  };

  renderTabs() {
    const { tabSources } = this.props;
    if (!tabSources) {
      return;
    }

    return (
      <div className="source-tabs" ref="sourceTabs">
        {tabSources.map((source, index) => {
          return (
            <Tab
              onDragStart={_ => this.onTabDragStart(source, index)}
              onDragOver={e => {
                this.onTabDragOver(e, source, index);
                e.preventDefault();
              }}
              onDragEnd={this.onTabDragEnd}
              key={index}
              source={source}
              ref={`tab_${source.id}`}
            />
          );
        })}
      </div>
    );
  }

  renderDropdown() {
    const hiddenTabs = this.state.hiddenTabs;
    if (!hiddenTabs || hiddenTabs.length == 0) {
      return null;
    }

    const Panel = <ul>{hiddenTabs.map(this.renderDropdownSource)}</ul>;
    const icon = <AccessibleImage className="more-tabs" />;

    return (
      <PortalDropdown
        buttonContent={icon}
        buttonStyle="dropdown-button"
        position="bottom-right"
        expanded={this.state.dropdownShown}
        setExpanded={this.setSourcesDropdownShown}
      >
        {Panel}
      </PortalDropdown>
    );
  }

  renderCommandBar() {
    const { horizontal, endPanelCollapsed, isPaused } = this.props;
    if (!endPanelCollapsed || !isPaused) {
      return;
    }

    return <CommandBar horizontal={horizontal} />;
  }

  render() {
    return (
      <div className="source-header">
        {this.renderTabs()}
        {this.renderDropdown()}
      </div>
    );
  }
}

const mapStateToProps = state => ({
  cx: getContext(state),
  selectedSource: getSelectedSource(state),
  tabSources: getSourcesForTabs(state),
  isPaused: getIsPaused(state),
});

export default connect(mapStateToProps, {
  selectSource: actions.selectSource,
  moveTab: actions.moveTab,
  moveTabBySourceId: actions.moveTabBySourceId,
  closeTab: actions.closeTab,
  showSource: actions.showSource,
})(Tabs);

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

import React, { PureComponent } from "react";
import { connect } from "../../../utils/connect";
import { createSelector } from "reselect";
import classnames from "classnames";

import actions from "../../../actions";
import { getLocationWithoutColumn, makeBreakpointId } from "../../../utils/breakpoint";
import { features } from "../../../utils/prefs";
import { getBreakpointsList, getSelectedFrame, getContext } from "../../../selectors";

import BreakpointNavigation from "./BreakpointNavigation";
import BreakpointHeading from "./BreakpointHeading";
import BreakpointOptions from "./BreakpointOptions";

class Breakpoint extends PureComponent {
  onContextMenu = e => {
    return;
  };

  get selectedLocation() {
    const { breakpoint } = this.props;
    return breakpoint.location;
  }

  selectBreakpoint = event => {
    event.preventDefault();
    const { cx, selectSpecificLocation } = this.props;
    selectSpecificLocation(cx, this.selectedLocation);
  };

  isCurrentlyPausedAtBreakpoint() {
    const { frame } = this.props;
    if (!frame) {
      return false;
    }

    const bpId = features.columnBreakpoints
      ? makeBreakpointId(this.selectedLocation)
      : getLocationWithoutColumn(this.selectedLocation);
    const frameId = features.columnBreakpoints
      ? makeBreakpointId(frame.selectedLocation)
      : getLocationWithoutColumn(frame.selectedLocation);
    return bpId == frameId;
  }

  render() {
    const { breakpoint, source, editor } = this.props;

    return (
      <div
        className={classnames({
          breakpoint,
          paused: this.isCurrentlyPausedAtBreakpoint(),
        })}
        onClick={this.selectBreakpoint}
        onContextMenu={this.onContextMenu}
      >
        <BreakpointHeading source={source} breakpoint={breakpoint} />
        <BreakpointOptions editor={editor} breakpoint={breakpoint} />
        <BreakpointNavigation breakpoint={breakpoint} />
      </div>
    );
  }
}

const getFormattedFrame = createSelector(getSelectedFrame, frame => {
  if (!frame) {
    return null;
  }

  return {
    ...frame,
    selectedLocation: frame.location,
  };
});

const mapStateToProps = state => ({
  cx: getContext(state),
  breakpoints: getBreakpointsList(state),
  frame: getFormattedFrame(state),
});

export default connect(mapStateToProps, {
  selectSpecificLocation: actions.selectSpecificLocation,
})(Breakpoint);

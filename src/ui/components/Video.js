import React, { useEffect } from "react";
import { connect } from "react-redux";
import { actions } from "ui/actions";
import { installObserver } from "../../protocol/graphics";
import { selectors } from "../reducers";

function Video({ togglePlayback, isNodePickerActive }) {
  useEffect(() => {
    installObserver();
  }, []);

  // This is intentionally mousedown. Otherwise, the NodePicker's mouseup callback fires
  // first. This updates the isNodePickerActive value and makes it look like the node picker is
  // inactive when we check it here.
  const onMouseDown = () => {
    if (isNodePickerActive) {
      return;
    }

    togglePlayback();
  };

  return (
    <div id="video" onMouseDown={onMouseDown}>
      <canvas id="graphics"></canvas>
      <div id="highlighter-root"></div>
    </div>
  );
}

export default connect(state => ({ isNodePickerActive: selectors.getIsNodePickerActive(state) }), {
  togglePlayback: actions.togglePlayback,
})(Video);

import ReactDOM from "react-dom";
import React from "react";
import { connect } from "react-redux";
import classnames from "classnames";

import { selectors } from "../../reducers";
import { actions } from "../../actions";
import { getPixelOffset, getLeftOffset, getCommentLeftOffset } from "../../utils/timeline";
import Dropdown from "devtools/client/debugger/src/components/shared/Dropdown";

class Comment extends React.Component {
  state = {
    editing: false,
  };

  onDescriptionChange = e => {
    const { comment, updateComment } = this.props;
    const contents = e.target.value;
    this.contents = e.target.value;
    if (e.charCode == "13") {
      this.setState({ editing: false });
      updateComment({ ...comment, contents });
    }
  };

  componentWillUnmount() {
    const { createComment, comment } = this.props;
    // re-create the comment if the user clicks away without saving
    if (comment.contents == "" && this.contents) {
      createComment({ ...comment, visible: false, contents: this.contents });
    }
  }

  startEditing = () => {
    this.setState({ editing: true });
  };

  stopEditing = () => {
    this.setState({ editing: false });
  };

  removeComment = () => {
    const { removeComment, comment } = this.props;
    removeComment(comment);
  };

  renderDropdownPanel() {
    return (
      <div className="dropdown-panel">
        <div className="menu-item" onClick={this.startEditing}>
          Edit Comment
        </div>
        <div className="menu-item" onClick={this.removeComment}>
          Delete Comment
        </div>
      </div>
    );
  }

  render() {
    const { comment, zoomRegion, index, timelineDimensions, showComment } = this.props;
    const { editing, description } = this.state;
    const commentWidth = 280;
    const offset = getPixelOffset({
      time: comment.time,
      overlayWidth: timelineDimensions.width,
      zoom: zoomRegion,
    });

    const commentLeftOffset = getCommentLeftOffset({
      time: comment.time,
      overlayWidth: timelineDimensions.width,
      zoom: zoomRegion,
      commentWidth: commentWidth,
    });
    const leftOffset = getLeftOffset({
      time: comment.time,
      overlayWidth: timelineDimensions.width,
      zoom: zoomRegion,
    });

    if (offset < 0) {
      return null;
    }

    if (!comment.visible) {
      return (
        <div
          className="comment-marker"
          key={comment.id}
          style={{
            left: `calc(${leftOffset}%)`,
          }}
          onClick={() => showComment(comment)}
        ></div>
      );
    }

    return (
      <div
        className={classnames("comment", {})}
        key={comment.id}
        style={{
          left: `${commentLeftOffset}%`,
          zIndex: `${index + 100}`,
          width: `${commentWidth}px`,
        }}
      >
        <div className="comment-body">
          {/* <div className="comment-avatar"></div> */}
          <div className="comment-content">
            <div className="comment-header">
              <div className="actions">
                <Dropdown panel={this.renderDropdownPanel()} icon={<div>⋯</div>} />
              </div>
            </div>
            <div className="comment-description">
              {editing || comment.contents == "" ? (
                <textarea
                  onBlur={this.stopEditing}
                  onKeyPress={this.onDescriptionChange}
                  defaultValue={comment.contents}
                />
              ) : (
                <div onDoubleClick={this.startEditing}>{comment.contents}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect(
  state => ({
    timelineDimensions: selectors.getTimelineDimensions(state),
    zoomRegion: selectors.getZoomRegion(state),
  }),
  {
    showComment: actions.showComment,
    updateComment: actions.updateComment,
    removeComment: actions.removeComment,
    createComment: actions.createComment,
  }
)(Comment);

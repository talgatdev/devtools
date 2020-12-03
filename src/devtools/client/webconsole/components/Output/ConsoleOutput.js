/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Component, createElement } = require("react");
const dom = require("react-dom-factories");
const { connect } = require("devtools/client/shared/redux/visibility-handler-connect");
const actions = require("devtools/client/webconsole/actions/index");
const ReactDOM = require("react-dom");

const {
  getAllMessagesById,
  getAllMessagesUiById,
  getAllMessagesPayloadById,
  getVisibleMessages,
  getPausedExecutionPoint,
  getAllWarningGroupsById,
  isMessageInWarningGroup,
} = require("devtools/client/webconsole/selectors/messages");

const PropTypes = require("prop-types");
const {
  MessageContainer,
} = require("devtools/client/webconsole/components/Output/MessageContainer");
const { pointPrecedes } = require("protocol/execution-point-utils");

const { MESSAGE_TYPE } = require("devtools/client/webconsole/constants");

function messageExecutionPoint(msg) {
  const { executionPoint, lastExecutionPoint } = msg;
  return executionPoint || (lastExecutionPoint && lastExecutionPoint.point);
}

function messageTime(msg) {
  const { executionPointTime, lastExecutionPoint } = msg;
  return executionPointTime || (lastExecutionPoint && lastExecutionPoint.time) || 0;
}

function getClosestMessage(visibleMessages, messages, executionPoint) {
  if (!executionPoint || !visibleMessages || !visibleMessages.length) {
    return null;
  }

  // If the pause location is before the first message, the first message is
  // marked as the paused one. This allows later messages to be grayed out but
  // isn't consistent with behavior for those other messages.
  let last = messages.get(visibleMessages[0]);

  for (const id of visibleMessages) {
    const msg = messages.get(id);
    const point = messageExecutionPoint(msg);
    if (point && pointPrecedes(executionPoint, point)) {
      break;
    }
    last = msg;
  }

  return last;
}

class ConsoleOutput extends Component {
  static get propTypes() {
    return {
      messages: PropTypes.object.isRequired,
      messagesUi: PropTypes.array.isRequired,
      timestampsVisible: PropTypes.bool,
      messagesPayload: PropTypes.object.isRequired,
      warningGroups: PropTypes.object.isRequired,
      visibleMessages: PropTypes.array.isRequired,
      pausedExecutionPoint: PropTypes.string,
    };
  }

  componentDidMount() {
    if (this.props.visibleMessages.length > 0) {
      scrollToBottom(this.outputNode);
    }
  }

  componentDidUpdate(prevProps) {
    this.maybeScrollToMessage(prevProps);
  }

  maybeScrollToMessage(prevProps) {
    const messagesDelta = this.props.messages.size - prevProps.messages.size;

    // [...this.props.messages.values()] seems slow
    // we should have a separate messageList somewhere we can check OR
    // use a memoization function to be able to get the last message quickly
    const lastMessage = [...this.props.messages.values()][this.props.messages.size - 1];

    if (messagesDelta <= 0 || lastMessage.type != MESSAGE_TYPE.RESULT) {
      return;
    }

    const node = ReactDOM.findDOMNode(this);
    const resultNode = node.querySelector(`div[data-message-id='${lastMessage.id}']`);

    if (!resultNode) {
      return;
    }

    // Scroll to the previous message node if it exists. It should be the
    // input which triggered the evaluation result we're scrolling to.
    const previous = resultNode.previousSibling;
    (previous || resultNode).scrollIntoView();
  }

  render() {
    let {
      dispatch,
      visibleMessages,
      messages,
      messagesUi,
      messagesPayload,
      warningGroups,
      timestampsVisible,
      pausedExecutionPoint,
      zoomStartTime,
      zoomEndTime,
    } = this.props;

    visibleMessages = visibleMessages.filter(id => {
      const msg = messages.get(id);
      const time = messageTime(msg);
      return time >= zoomStartTime && time <= zoomEndTime;
    });

    const pausedMessage = getClosestMessage(visibleMessages, messages, pausedExecutionPoint);
    const messageNodes = visibleMessages.map(messageId =>
      createElement(MessageContainer, {
        dispatch,
        key: messageId,
        messageId,
        open: messagesUi.includes(messageId),
        payload: messagesPayload.get(messageId),
        timestampsVisible,
        badge: warningGroups.has(messageId) ? warningGroups.get(messageId).length : null,
        inWarningGroup:
          warningGroups && warningGroups.size > 0
            ? isMessageInWarningGroup(messages.get(messageId), visibleMessages)
            : false,
        pausedExecutionPoint,
        getMessage: () => messages.get(messageId),
        isPaused: !!pausedMessage && pausedMessage.id == messageId,
      })
    );

    return dom.div(
      {
        className: "webconsole-output",
        role: "main",
        ref: node => {
          this.outputNode = node;
        },
      },
      messageNodes
    );
  }
}

function scrollToBottom(node) {
  if (node.scrollHeight > node.clientHeight) {
    node.scrollTop = node.scrollHeight;
  }
}

function mapStateToProps(state, props) {
  return {
    pausedExecutionPoint: getPausedExecutionPoint(state),
    messages: getAllMessagesById(state),
    visibleMessages: getVisibleMessages(state),
    messagesUi: getAllMessagesUiById(state),
    messagesPayload: getAllMessagesPayloadById(state),
    warningGroups: getAllWarningGroupsById(state),
    timestampsVisible: state.consoleUI.timestampsVisible,
    zoomStartTime: state.consoleUI.zoomStartTime,
    zoomEndTime: state.consoleUI.zoomEndTime,
  };
}
const mapDispatchToProps = dispatch => ({
  openLink: actions.openLink,
  dispatch,
});

module.exports = connect(mapStateToProps, mapDispatchToProps)(ConsoleOutput);

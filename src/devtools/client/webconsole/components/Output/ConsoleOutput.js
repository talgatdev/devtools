/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Component, createElement } = require("react");
const dom = require("react-dom-factories");
const { connect } = require("devtools/client/shared/redux/visibility-handler-connect");
const { initialize } = require("devtools/client/webconsole/actions/ui");

const {
  getAllMessagesById,
  getAllMessagesUiById,
  getAllMessagesPayloadById,
  getVisibleMessages,
  getPausedExecutionPoint,
  getPausedExecutionPointTime,
  getAllWarningGroupsById,
  isMessageInWarningGroup,
} = require("devtools/client/webconsole/selectors/messages");

const PropTypes = require("prop-types");
const {
  MessageContainer,
} = require("devtools/client/webconsole/components/Output/MessageContainer");
const { pointPrecedes } = require("protocol/execution-point-utils.js");

const { MESSAGE_TYPE } = require("devtools/client/webconsole/constants");
const {
  getInitialMessageCountForViewport,
} = require("devtools/client/webconsole/utils/messages.js");

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
      initialized: PropTypes.bool.isRequired,
      messages: PropTypes.object.isRequired,
      messagesUi: PropTypes.array.isRequired,
      serviceContainer: PropTypes.shape({
        attachRefToWebConsoleUI: PropTypes.func.isRequired,
      }),
      dispatch: PropTypes.func.isRequired,
      timestampsVisible: PropTypes.bool,
      messagesPayload: PropTypes.object.isRequired,
      warningGroups: PropTypes.object.isRequired,
      visibleMessages: PropTypes.array.isRequired,
      onFirstMeaningfulPaint: PropTypes.func.isRequired,
      pausedExecutionPoint: PropTypes.string,
      pausedExecutionPointTime: PropTypes.number,
    };
  }

  constructor(props) {
    super(props);
    this.maybeScrollToBottom = this.maybeScrollToBottom.bind(this);
    gToolbox.consoleOutput = this;
  }

  componentDidMount() {
    if (this.props.visibleMessages.length > 0) {
      scrollToBottom(this.outputNode);
    }

    const { serviceContainer, onFirstMeaningfulPaint, dispatch } = this.props;
    serviceContainer.attachRefToWebConsoleUI("outputScroller", this.outputNode);

    // Waiting for the next paint.
    new Promise(res => requestAnimationFrame(res)).then(() => {
      if (onFirstMeaningfulPaint) {
        onFirstMeaningfulPaint();
      }

      // Dispatching on next tick so we don't block on action execution.
      setTimeout(() => {
        dispatch(initialize());
      }, 0);
    });
  }

  UNSAFE_componentWillUpdate(nextProps, nextState) {
    const outputNode = this.outputNode;
    if (!outputNode || !outputNode.lastChild) {
      // Force a scroll to bottom when messages are added to an empty console.
      // This makes the console stay pinned to the bottom if a batch of messages
      // are added after a page refresh (Bug 1402237).
      this.shouldScrollBottom = true;
      return;
    }

    // We need to scroll to the bottom if:
    // - we are reacting to "initialize" action, and we are already scrolled to the bottom
    // - the number of messages displayed changed and we are already scrolled to the
    //   bottom, but not if we are reacting to a group opening.

    const lastChild = outputNode.lastChild;
    const visibleMessagesDelta =
      nextProps.visibleMessages.length - this.props.visibleMessages.length;
    const messagesDelta = nextProps.messages.size - this.props.messages.size;

    const messagesUiDelta = nextProps.messagesUi.length - this.props.messagesUi.length;
    const isOpeningGroup =
      messagesUiDelta > 0 &&
      nextProps.messagesUi.some(
        id =>
          !this.props.messagesUi.includes(id) &&
          nextProps.messagesUi.includes(id) &&
          this.props.visibleMessages.includes(id) &&
          nextProps.visibleMessages.includes(id)
      );

    this.shouldScrollBottom =
      (!this.props.initialized &&
        nextProps.initialized &&
        isScrolledToBottom(lastChild, outputNode)) ||
      (isScrolledToBottom(lastChild, outputNode) && visibleMessagesDelta > 0 && !isOpeningGroup);

    // When evaluation results are added, scroll to them.
    this.shouldScrollMessageId = null;
    this.shouldScrollMessageNode = null;
    if (messagesDelta > 0) {
      const lastMessage = [...nextProps.messages.values()][nextProps.messages.size - 1];
      if (lastMessage.type == MESSAGE_TYPE.RESULT) {
        this.shouldScrollMessageId = lastMessage.id;
      }
    }
  }

  componentDidUpdate() {
    this.maybeScrollToBottom();

    if (this.shouldScrollMessageNode) {
      // Scroll to the previous message node if it exists. It should be the
      // input which triggered the evaluation result we're scrolling to.
      const previous = this.shouldScrollMessageNode.previousSibling;
      (previous || this.shouldScrollMessageNode).scrollIntoView();
      this.shouldScrollMessageNode = null;
    }
  }

  maybeScrollToBottom() {
    if (this.outputNode && this.shouldScrollBottom) {
      scrollToBottom(this.outputNode);
    }
  }

  render() {
    let {
      dispatch,
      visibleMessages,
      messages,
      messagesUi,
      messagesPayload,
      warningGroups,
      serviceContainer,
      timestampsVisible,
      initialized,
      pausedExecutionPoint,
      pausedExecutionPointTime,
      zoomStartTime,
      zoomEndTime,
    } = this.props;

    if (!initialized) {
      const numberMessagesFitViewport = getInitialMessageCountForViewport(window);
      if (numberMessagesFitViewport < visibleMessages.length) {
        visibleMessages = visibleMessages.slice(visibleMessages.length - numberMessagesFitViewport);
      }
    }

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
        serviceContainer,
        open: messagesUi.includes(messageId),
        payload: messagesPayload.get(messageId),
        timestampsVisible,
        badge: warningGroups.has(messageId) ? warningGroups.get(messageId).length : null,
        inWarningGroup:
          warningGroups && warningGroups.size > 0
            ? isMessageInWarningGroup(messages.get(messageId), visibleMessages)
            : false,
        pausedExecutionPoint,
        pausedExecutionPointTime,
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

function isScrolledToBottom(lastNode, scrollNode) {
  const lastNodeHeight = lastNode ? lastNode.clientHeight : 0;
  return (
    scrollNode.scrollTop + scrollNode.clientHeight >= scrollNode.scrollHeight - lastNodeHeight / 2
  );
}

function mapStateToProps(state, props) {
  return {
    initialized: state.ui.initialized,
    pausedExecutionPoint: getPausedExecutionPoint(state),
    pausedExecutionPointTime: getPausedExecutionPointTime(state),
    messages: getAllMessagesById(state),
    visibleMessages: getVisibleMessages(state),
    messagesUi: getAllMessagesUiById(state),
    messagesPayload: getAllMessagesPayloadById(state),
    warningGroups: getAllWarningGroupsById(state),
    timestampsVisible: state.ui.timestampsVisible,
    zoomStartTime: state.ui.zoomStartTime,
    zoomEndTime: state.ui.zoomEndTime,
  };
}

module.exports = connect(mapStateToProps)(ConsoleOutput);

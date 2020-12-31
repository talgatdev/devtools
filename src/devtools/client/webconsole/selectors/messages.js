/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { getWarningGroupType } = require("devtools/client/webconsole/utils/messages");
const {
  getParentWarningGroupMessageId,
  isError,
} = require("devtools/client/webconsole/utils/messages");
const { pointPrecedes } = require("protocol/execution-point-utils");
const { MESSAGE_TYPE } = require("devtools/client/webconsole/constants");

import { createSelector } from "reselect";

export const getAllMessagesUiById = state => state.messages.messagesUiById;
export const getAllMessagesPayloadById = state => state.messages.messagesPayloadById;
export const getAllGroupsById = state => state.messages.groupsById;
export const getCurrentGroup = state => state.messages.currentGroup;
export const getFilteredMessagesCount = state => state.messages.filteredMessagesCount;
export const getAllRepeatById = state => state.messages.repeatById;
export const getGroupsById = state => state.messages.groupsById;
export const getPausedExecutionPoint = state => state.messages.pausedExecutionPoint;
export const getPausedExecutionPointTime = state => state.messages.pausedExecutionPointTime;
export const getAllWarningGroupsById = state => state.messages.warningGroupsById;

function messageTime(msg) {
  const { executionPointTime, lastExecutionPoint } = msg;
  return executionPointTime || (lastExecutionPoint && lastExecutionPoint.time) || 0;
}

export function getAllMessagesById(state) {
  return state.messages.messagesById;
}

export const getVisibleMessages = createSelector(
  getAllMessagesById,
  state => state.messages.visibleMessages,
  state => state.consoleUI.zoomStartTime,
  state => state.consoleUI.zoomEndTime,
  (messages, visibleMessages, zoomStartTime, zoomEndTime) => {
    return visibleMessages.filter(id => {
      const msg = messages.get(id);
      const time = messageTime(msg);
      return time >= zoomStartTime && time <= zoomEndTime;
    });
  }
);

export const getMessages = createSelector(
  getAllMessagesById,
  getVisibleMessages,
  (messagesById, visibleMessages) => visibleMessages.map(id => messagesById.get(id))
);

export const getMessagesForTimeline = createSelector(getMessages, messages =>
  messages.filter(message => message.source == "console-api" || isError(message))
);

function messageExecutionPoint(msg) {
  const { executionPoint, lastExecutionPoint } = msg;
  return executionPoint || (lastExecutionPoint && lastExecutionPoint.point);
}

export const getClosestMessage = createSelector(
  getVisibleMessages,
  getAllMessagesById,
  getPausedExecutionPoint,
  (visibleMessages, messages, executionPoint) => {
    if (!executionPoint || !visibleMessages || !visibleMessages.length) {
      return null;
    }

    // If the pause location is before the first message, the first message is
    // marked as the paused one. This allows later messages to be grayed out but
    // isn't consistent with behavior for those other messages.
    let last = messages.get(visibleMessages[0]);

    for (const id of visibleMessages) {
      const msg = messages.get(id);

      // Skip evaluations, which will always occur at the same evaluation point as
      // a logpoint or log
      if (msg.type == MESSAGE_TYPE.COMMAND || msg.type == MESSAGE_TYPE.RESULT) {
        continue;
      }

      const point = messageExecutionPoint(msg);
      if (point && pointPrecedes(executionPoint, point)) {
        break;
      }

      last = msg;
    }

    return last;
  }
);

export function getMessage(state, id) {
  return getAllMessagesById(state).get(id);
}

export function isMessageInWarningGroup(message, visibleMessages = []) {
  if (!getWarningGroupType(message)) {
    return false;
  }

  return visibleMessages.includes(getParentWarningGroupMessageId(message));
}

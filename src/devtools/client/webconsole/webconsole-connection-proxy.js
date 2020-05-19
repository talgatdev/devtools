/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { ThreadFront } = require("protocol/thread");

function WebConsoleConnectionProxy(ui) {
  this.ui = ui;

  ThreadFront.findConsoleMessages(msg => this.onConsoleMessage(msg));
}

function convertStack(stack, { frames }) {
  if (!stack) {
    return null;
  }
  return stack.map(frameId => {
    const frame = frames.find(f => f.frameId == frameId);
    return {
      filename: ThreadFront.getScriptURL(frame.location.sourceId),
      sourceId: frame.location.scriptId,
      lineNumber: frame.location.line,
      columnNumber: frame.location.column,
      functionName: frame.functionName,
    };
  });
}

// See also commands.js :/
function convertProtocolValue({ value, unserializableNumber, bigint, object }) {
  if (object) {
    // NYI
    return undefined;
  }
  if (unserializableNumber) {
    return Number(unserializableNumber);
  }
  if (bigint) {
    return bigint;
  }
  return value;
}

WebConsoleConnectionProxy.prototype = {
  onConsoleMessage(msg) {
    //console.log("ConsoleMessage", msg);

    const stacktrace = convertStack(msg.stack, msg.data);

    let argumentValues;
    if (msg.argumentValues) {
      argumentValues = msg.argumentValues.map(convertProtocolValue);
    }

    const sourceId = stacktrace ? stacktrace[0].sourceId : undefined;

    const packet = {
      errorMessage: msg.text,
      errorMessageName: "ErrorMessageName",
      sourceName: msg.url,
      sourceId,
      lineNumber: msg.line,
      columnNumber: msg.column,
      category: msg.source,
      warning: msg.level == "warning",
      error: msg.level == "error",
      info: msg.level == "info",
      stacktrace,
      argumentValues,
      executionPoint: msg.point.point,
      executionPointTime: msg.point.time,
      executionPointHasFrames: !!stacktrace,
    };

    this.ui.wrapper.dispatchMessageAdd(packet);
  },
};

exports.WebConsoleConnectionProxy = WebConsoleConnectionProxy;

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { ThreadFront } = require("protocol/thread");
const { LogpointHandlers } = require("protocol/logpoint");

function WebConsoleConnectionProxy(ui) {
  this.ui = ui;

  ThreadFront.findConsoleMessages(this.onConsoleMessage.bind(this));

  LogpointHandlers.onPointLoading = this.onLogpointLoading.bind(this);
  LogpointHandlers.onResult = this.onLogpointResult.bind(this);
  LogpointHandlers.clearLogpoint = this.clearLogpoint.bind(this);
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

WebConsoleConnectionProxy.prototype = {
  onConsoleMessage(pause, msg) {
    //console.log("ConsoleMessage", msg);

    const stacktrace = convertStack(msg.stack, msg.data);
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
      argumentValues: msg.argumentValues,
      executionPoint: msg.point.point,
      executionPointTime: msg.point.time,
      executionPointHasFrames: !!stacktrace,
    };

    this.ui.wrapper.dispatchMessageAdd(packet);
  },

  onLogpointLoading(logGroupId, point, time, { scriptId, line, column }) {
    const packet = {
      errorMessage: "Loading...",
      sourceName: ThreadFront.getScriptURL(scriptId),
      sourceId: scriptId,
      lineNumber: line,
      columnNumber: column,
      category: "ConsoleAPI",
      info: true,
      executionPoint: point,
      executionPointTime: time,
      executionPointHasFrames: true,
      logpointId: logGroupId,
    };

    this.ui.wrapper.dispatchMessageAdd(packet);
  },

  onLogpointResult(logGroupId, point, time, { scriptId, line, column }, pause, values) {
    const argumentValues = values.map(v => convertProtocolValue(pause, v));

    const packet = {
      errorMessage: "",
      sourceName: ThreadFront.getScriptURL(scriptId),
      sourceId: scriptId,
      lineNumber: line,
      columnNumber: column,
      category: "ConsoleAPI",
      info: true,
      argumentValues,
      executionPoint: point,
      executionPointTime: time,
      executionPointHasFrames: true,
      logpointId: logGroupId,
    };

    this.ui.wrapper.dispatchMessageAdd(packet);
  },

  clearLogpoint(logGroupId) {
    this.ui.wrapper.dispatchClearLogpointMessages(logGroupId);
  },
};

exports.WebConsoleConnectionProxy = WebConsoleConnectionProxy;

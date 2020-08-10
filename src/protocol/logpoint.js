/*
BSD 3-Clause License

Copyright (c) 2020 Record Replay Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

// Logpoints are used to perform evaluations at sets of execution points in the
// recording being debugged. They are implemented using the RRP Analysis domain.
// This file manages logpoint state, for setting/removing logpoints and emitting
// events which the webconsole listens to.
//
// Each logpoint has an associated log group ID, used to manipulate all the
// messages associated with the logpoint atomically.

const { addEventListener, sendMessage, log } = require("./socket");
const { assert, defer } = require("./utils");
const { ThreadFront, ValueFront, Pause } = require("./thread");
const { logpointGetFrameworkEventListeners } = require("./event-listeners");

// Map log group ID to information about the logpoint.
const gLogpoints = new Map();

// Map analysis ID to log group ID.
const gAnalysisLogGroupIDs = new Map();

// Hooks for adding messages to the console.
const LogpointHandlers = {};

addEventListener("Analysis.analysisResult", ({ analysisId, results }) => {
  log(`AnalysisResults ${results.length}`);

  const logGroupId = gAnalysisLogGroupIDs.get(analysisId);
  if (!gLogpoints.has(logGroupId)) {
    return;
  }

  if (LogpointHandlers.onResult) {
    results.forEach(async ({
      key,
      value: { time, pauseId, location, values, data, frameworkListeners },
    }) => {
      const pause = new Pause(ThreadFront.sessionId);
      pause.instantiate(pauseId);
      pause.addData(data);
      const valueFronts = values.map(v => new ValueFront(pause, v));
      const mappedLocation = await ThreadFront.getPreferredMappedLocation(location[0]);
      LogpointHandlers.onResult(logGroupId, key, time, mappedLocation, pause, valueFronts);

      if (frameworkListeners) {
        const frameworkListenersFront = new ValueFront(pause, frameworkListeners);
        eventLogpointOnFrameworkListeners(logGroupId, key, frameworkListenersFront);
      }
    });
  }
});

addEventListener("Analysis.analysisPoints", ({ analysisId, points }) => {
  log(`AnalysisPoints ${points.length}`);

  const logGroupId = gAnalysisLogGroupIDs.get(analysisId);
  const info = gLogpoints.get(logGroupId);
  if (!info) {
    return;
  }

  info.points.push(...points);
  if (info.pointsWaiter) {
    info.pointsWaiter();
  }

  if (LogpointHandlers.onPointLoading) {
    points.forEach(async ({ point, time, frame }) => {
      const location = await ThreadFront.getPreferredLocation(frame);
      LogpointHandlers.onPointLoading(logGroupId, point, time, location);
    });
  }
});

async function createLogpointAnalysis(logGroupId, mapper) {
  if (!gLogpoints.has(logGroupId)) {
    gLogpoints.set(logGroupId, { analysisWaiters: [], points: [] });
  }

  const waiter = sendMessage("Analysis.createAnalysis", {
    mapper,
    effectful: true,
  });
  gLogpoints.get(logGroupId).analysisWaiters.push(waiter);

  const { analysisId } = await waiter;
  gAnalysisLogGroupIDs.set(analysisId, logGroupId);
  return analysisId;
}

// Define some logpoint helpers to manage pause data.
const Helpers = `
  const finalData = { frames: [], scopes: [], objects: [] };
  function addPauseData({ frames, scopes, objects }) {
    finalData.frames.push(...(frames || []));
    finalData.scopes.push(...(scopes || []));
    finalData.objects.push(...(objects || []));
  }
  function getTopFrame() {
    const { frame, data } = sendCommand("Pause.getTopFrame");
    addPauseData(data);
    return finalData.frames.find(f => f.frameId == frame);
  }
`;

// Given an RRP value representing an array, add the elements of that array to
// the given values/data arrays.
function mapperExtractArrayContents(arrayPath, valuesPath) {
  return `{
    const { object } = ${arrayPath};
    const { result: lengthResult } = sendCommand(
      "Pause.getObjectProperty",
      { object, name: "length" }
    );
    addPauseData(lengthResult.data);
    const length = lengthResult.returned.value;
    for (let i = 0; i < length; i++) {
      const { result: elementResult } = sendCommand(
        "Pause.getObjectProperty",
        { object, name: i.toString() }
      );
      ${valuesPath}.push(elementResult.returned);
      addPauseData(elementResult.data);
    }
  }`;
}

async function setLogpoint(logGroupId, scriptId, line, column, text, condition) {
  let conditionSection = "";
  if (condition) {
    // When there is a condition, don't add a message if it returns undefined
    // or a falsy primitive.
    conditionSection = `
      const { result: conditionResult } = sendCommand(
        "Pause.evaluateInFrame",
        { frameId, expression: ${JSON.stringify(condition)} }
      );
      addPauseData(conditionResult.data);
      if (conditionResult.returned) {
        const { returned } = conditionResult;
        if ("value" in returned && !returned.value) {
          return [];
        }
        if (!Object.keys(returned).length) {
          // Undefined.
          return [];
        }
      }
    `;
  }

  const mapper = `
    ${Helpers}
    const { point, time, pauseId } = input;
    const { frameId, functionName, location } = getTopFrame();
    ${conditionSection}
    const bindings = [
      { name: "displayName", value: functionName || "" }
    ];
    const { result } = sendCommand(
      "Pause.evaluateInFrame",
      { frameId, bindings, expression: "[" + ${JSON.stringify(text)} + "]" }
    );
    const values = [];
    addPauseData(result.data);
    if (result.exception) {
      values.push(result.exception);
    } else {
      ${mapperExtractArrayContents("result.returned", "values")}
    }
    return [{
      key: point,
      value: { time, pauseId, location, values, data: finalData },
    }];
  `;

  const analysisId = await createLogpointAnalysis(logGroupId, mapper);

  sendMessage("Analysis.addLocation", {
    analysisId,
    sessionId: await ThreadFront.waitForSession(),
    location: { scriptId, line, column },
  });
  sendMessage("Analysis.runAnalysis", { analysisId });

  // Don't add loading messages for conditional logpoints, as we don't know if
  // analysis points will actually generate a message.
  if (!condition) {
    sendMessage("Analysis.findAnalysisPoints", { analysisId });
  }
}

function setLogpointByURL(logGroupId, scriptUrl, line, column, text, condition) {
  const scriptIds = ThreadFront.urlScripts.map.get(scriptUrl);
  (scriptIds || []).forEach(scriptId => {
    setLogpoint(logGroupId, scriptId, line, column, text, condition);
  });
}

// Event listener logpoints use a multistage analysis. First, the normal
// logpoint analysis runs to generate points for the points where regular
// DOM event listeners are called by the browser. During this first analysis,
// we look for framework event listeners attached to the nodes that are
// targeted by the discovered events.
//
// In the second phase, we create a new analysis for each point which framework
// event listeners are associated with. This analysis runs against each call
// to the framework event listener during the scope of the regular DOM event
// listener.
function eventLogpointMapper(getFrameworkListeners) {
  let frameworkText = "";
  if (getFrameworkListeners) {
    frameworkText = logpointGetFrameworkEventListeners(
      "frameId", "frameworkListeners"
    );
  }
  return `
    ${Helpers}
    const { point, time, pauseId } = input;
    const { frameId, location } = getTopFrame();
    const { result } = sendCommand(
      "Pause.evaluateInFrame",
      { frameId, expression: "[...arguments]" }
    );
    const values = [];
    addPauseData(result.data);
    if (result.exception) {
      values.push(result.exception);
    } else {
      ${mapperExtractArrayContents("result.returned", "values")}
    }
    let frameworkListeners;
    ${frameworkText}
    return [{
      key: point,
      value: { time, pauseId, location, values, data: finalData, frameworkListeners },
    }];
  `;
}

async function setEventLogpoint(logGroupId, eventTypes) {
  const mapper = eventLogpointMapper(/* getFrameworkListeners */ true);
  const analysisId = await createLogpointAnalysis(logGroupId, mapper);

  for (const eventType of eventTypes) {
    sendMessage("Analysis.addEventHandlerEntryPoints", {
      analysisId,
      sessionId: await ThreadFront.waitForSession(),
      eventType,
    });
  }

  sendMessage("Analysis.runAnalysis", { analysisId });
  sendMessage("Analysis.findAnalysisPoints", { analysisId });
}

async function eventLogpointOnFrameworkListeners(logGroupId, point, frameworkListeners) {
  const locations = [];
  const children = await frameworkListeners.loadChildren();
  for (const { contents } of children) {
    if (contents.isObject() && contents.className() == "Function") {
      locations.push(contents.functionLocationFromLogpoint());
    }
  }
  if (!locations.length) {
    return;
  }

  const mapper = eventLogpointMapper(/* getFrameworkListeners */ false);
  const analysisId = await createLogpointAnalysis(logGroupId, mapper);

  for (const location of locations) {
    sendMessage("Analysis.addLocation", {
      analysisId,
      sessionId: await ThreadFront.waitForSession(),
      location,
      onStackFrame: point,
    });
  }

  sendMessage("Analysis.runAnalysis", { analysisId });
  sendMessage("Analysis.findAnalysisPoints", { analysisId });
}

async function setExceptionLogpoint(logGroupId) {
  const mapper = `
    ${Helpers}
    const { point, time, pauseId } = input;
    const { frameId, location } = getTopFrame();
    const { exception, data: exceptionData } = sendCommand("Pause.getExceptionValue");
    addPauseData(exceptionData);
    const values = [{ value: "Exception" }, exception];
    return [{
      key: point,
      value: { time, pauseId, location, values, data: finalData },
    }];
  `;

  const analysisId = await createLogpointAnalysis(logGroupId, mapper);

  sendMessage("Analysis.addExceptionPoints", {
    analysisId,
    sessionId: await ThreadFront.waitForSession(),
  });

  sendMessage("Analysis.runAnalysis", { analysisId });
  sendMessage("Analysis.findAnalysisPoints", { analysisId });
}

// Add logpoint messages at random function entry points, and returns text
// patterns that will appear in the resulting messages. This is used by
// automated tests.
async function setRandomLogpoint(numLogs) {
  const mapper = `
    const { point, time, pauseId} = input;
    const { frameId, location } = getTopFrame();
    const { result } = sendCommand(
      "Pause.evaluateInFrame",
      { frameId, expression: "String([...arguments]).substring(0, 200)" }
    );
    const v = result.returned ? String(result.returned.value) : "";
    const values = [{ value: point + ": " + v }];
    return [{ key: point, value: { time, pauseId, location, values, data: {} } }];
  `;

  const logGroupId = Math.random().toString();
  const analysisId = await createLogpointAnalysis(logGroupId, mapper);

  sendMessage("Analysis.addRandomPoints", {
    analysisId,
    sessionId: await ThreadFront.waitForSession(),
    numPoints: numLogs,
  });

  sendMessage("Analysis.runAnalysis", { analysisId });
  sendMessage("Analysis.findAnalysisPoints", { analysisId });

  const info = gLogpoints.get(logGroupId);
  while (info.points.length < numLogs) {
    const { promise, resolve } = defer();
    info.pointsWaiter = resolve;
    await promise;
  }

  return info.points.map(p => p.point);
}

function removeLogpoint(logGroupId) {
  const info = gLogpoints.get(logGroupId);
  if (!info) {
    return;
  }
  if (LogpointHandlers.clearLogpoint) {
    LogpointHandlers.clearLogpoint(logGroupId);
  }
  gLogpoints.delete(logGroupId);
  info.analysisWaiters.forEach(async waiter => {
    const { analysisId } = await waiter;
    sendMessage("Analysis.releaseAnalysis", { analysisId });
  });
}

module.exports = {
  setLogpoint,
  setLogpointByURL,
  setEventLogpoint,
  setExceptionLogpoint,
  setRandomLogpoint,
  removeLogpoint,
  LogpointHandlers,
};

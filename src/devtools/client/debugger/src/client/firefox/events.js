/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

// @flow

import type {
  SourcePacket,
  PausedPacket,
  Target,
  DevToolsClient,
} from "./types";

import Actions from "../../actions";

import { createPause, prepareSourcePayload, createFrame } from "./create";
import { clientCommands } from "./commands";
import sourceQueue from "../../utils/source-queue";
import { prefs, features } from "../../utils/prefs";

const {
  WorkersListener,
  // $FlowIgnore
} = require("devtools/client/shared/workers-listener.js");

const { ThreadFront } = require("protocol/thread");
const { log } = require("protocol/socket");

type Dependencies = {
  actions: typeof Actions,
  devToolsClient: DevToolsClient,
};

let actions: typeof Actions;
let isInterrupted: boolean;
let panel;

function addThreadEventListeners(thread: ThreadFront) {
  const removeListeners = [];
  threadFrontListeners.set(thread, removeListeners);
  thread.replayFetchPreloadedData();
}

function setupEvents(dependencies: Dependencies) {
  const { devToolsClient } = dependencies;
  actions = dependencies.actions;
  panel = dependencies.panel;
  sourceQueue.initialize(actions);

  Object.keys(clientEvents).forEach(eventName => {
    ThreadFront.on(eventName, clientEvents[eventName].bind(null, ThreadFront));
  });
}

function removeEventsTopTarget(targetFront: Target) {
  targetFront.off("workerListChanged", threadListChanged);
  removeThreadEventListeners(targetFront.threadFront);
  workersListener.removeListener();
}

async function paused(threadFront, { point }) {
  log("ThreadFront.paused");
  actions.paused({ thread: threadFront.actor, executionPoint: point });
}

function resumed(threadFront) {
  // NOTE: the client suppresses resumed events while interrupted
  // to prevent unintentional behavior.
  // see [client docs](../README.md#interrupted) for more information.
  if (isInterrupted) {
    isInterrupted = false;
    return;
  }

  actions.resumed(threadFront.actor);
}

function newSource(threadFront, { source }: SourcePacket) {
  sourceQueue.queue({
    type: "generated",
    data: prepareSourcePayload(threadFront, source),
  });
}

function threadListChanged() {
  actions.updateThreads();
}

function replayFramePositions(
  threadFront,
  { positions, unexecutedLocations, frame, thread }: Object
) {
  actions.setFramePositions(positions, unexecutedLocations, frame, thread);
}

// Copied from execution-point-utils.js, which has trouble being
// require()'ed here for some reason.

function positionToString(pos) {
  return `${pos.kind}:${pos.script}:${pos.offset}:${pos.frameIndex}`;
}

function pointToString(point) {
  if (point.position) {
    return `${point.checkpoint}:${point.progress}:${positionToString(
      point.position
    )}`;
  }
  return `${point.checkpoint}:${point.progress}`;
}

// execution point => step targets from that point
const gStepTargets = new Map();

// execution point => pause info for that point
const gPausePackets = new Map();

// actor ID => cached form for that actor
const gCachedForms = new Map();

// source actor ID => frame forms waiting on that actor to be registered
const gPendingForms = new Map();

// Destructively modify a piece of JSON by replacing references to cached forms
// with the actual form, reconstructing a complete form with the contents
// expected by other parts of the client.
function replaceCachedFormReferences(json) {
  if (!json || typeof json != "object") {
    return;
  }

  if (Array.isArray(json)) {
    for (let i = 0; i < json.length; i++) {
      const v = json[i];
      if (v && v.cached) {
        json[i] = replaceCachedForm(v);
      } else {
        replaceCachedFormReferences(v);
      }
    }
  } else {
    for (const [key, v] of Object.entries(json)) {
      if (v && v.cached) {
        json[key] = replaceCachedForm(v);
      } else {
        replaceCachedFormReferences(v);
      }
    }
  }
}

function preloadFrameForm(form) {
  const location = {
    sourceId: clientCommands.getSourceForActor(form.where.actor),
    line: form.where.line,
    column: form.where.column,
  };
  addMappedLocation(location);
  addScopes(location);
}

function addCachedForm(form) {
  if (!form.actor) {
    throw new Error("Expected cached form actor");
  }

  replaceCachedFormReferences(form);
  gCachedForms.set(form.actor, form);

  // Save the results of source mapping any frames we encounter.
  if (form.where) {
    try {
      preloadFrameForm(form);
    } catch (e) {
      // The form's source hasn't appeared yet.
      const existing = gPendingForms.get(form.where.actor);
      if (existing) {
        existing.push(form);
      } else {
        gPendingForms.set(form.where.actor, [form]);
      }
    }
  }
}

function onSourceActorRegister(actor) {
  const pending = gPendingForms.get(actor);
  if (pending) {
    pending.forEach(preloadFrameForm);
    gPendingForms.delete(actor);
  }
}

function replaceCachedForm(form) {
  if (!form.cached) {
    throw new Error("Expected cached form reference");
  }

  const cached = gCachedForms.get(form.cached);
  if (!cached) {
    throw new Error("Unknown cached form");
  }

  return cached;
}

function replayPreloadedData(threadFront, entry) {
  switch (entry.data.kind) {
    case "InvalidateStepTargets":
      gStepTargets.clear();
      break;
    case "StepTargets": {
      const { point, stepOver, stepIn, stepOut, reverseStepOver } = entry.data;
      gStepTargets.set(pointToString(point), { stepOver, stepIn, stepOut, reverseStepOver });
      break;
    }
    case "PauseData": {
      const { point, environment, frames, cachedForms } = entry.data;
      cachedForms.forEach(addCachedForm);
      gPausePackets.set(pointToString(point), {
        frames: frames.map(replaceCachedForm),
        environment: replaceCachedForm(environment),
      });
      break;
    }
    default:
      throw new Error("Bad preloaded data kind");
  }
}

function isNonNullObject(obj) {
  return obj && (typeof obj == "object" || typeof obj == "function");
}

// Note: Logging mismatches exposes information about the current site.
// This comparison only occurs during automated tests.
function reportMismatch(a, b) {
  const astr = JSON.stringify(a);
  const bstr = JSON.stringify(b);
  ChromeUtils.recordReplayLog(`Error: Packet compare mismatch expected ${astr} received ${bstr}`);
}

function compareObjects(a, b) {
  if (
    !isNonNullObject(a) ||
    !isNonNullObject(b) ||
    Array.isArray(a) != Array.isArray(b)
  ) {
    if (a !== b) {
      reportMismatch(a, b);
      return false;
    }
    return true;
  }

  if (Array.isArray(a)) {
    if (a.length != b.length) {
      reportMismatch(a, b);
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!compareObjects(a[i], b[i])) {
        reportMismatch(a, b);
        return false;
      }
    }
    return true;
  }

  let akeys = Object.keys(a).sort();
  let bkeys = Object.keys(b).sort();

  // The expected value (the one we used to update the client) can contain more
  // information than the actual pause packet. This happens when the same object
  // appears in multiple places with different depths. The actual pause packet
  // only includes previews where the depth is sufficiently low, but the one
  // used to update the client uses the more detailed form everywhere the object
  // appears. Tolerate this difference.

  function maybeRemoveKey(type, value, key) {
    if (a[type] == value && akeys.includes(key) && !bkeys.includes(key)) {
      akeys = akeys.filter(k => k != key);
    }
  }

  // Watch for objects that include vs. don't include previews.
  maybeRemoveKey("type", "object", "preview");

  // Watch for different levels of detail within object previews.
  maybeRemoveKey("kind", "ArrayLike", "items");
  maybeRemoveKey("kind", "DOMEvent", "target");

  if (akeys.length != bkeys.length) {
    reportMismatch(a, b);
    return false;
  }
  for (let i = 0; i < akeys.length; i++) {
    if (akeys[i] != bkeys[i]) {
      reportMismatch(a, b);
      return false;
    }
    const key = akeys[i];
    if (!compareObjects(a[key], b[key])) {
      reportMismatch(a, b);
      return false;
    }
  }
  return true;
}

// Handle an event emitted during automated testing which includes the pause
// information that would have been generated by the thread had it not instantly
// warped to that point. Make sure that the thread's packet and the packet used
// to update the client from preloaded data are identical.
function instantWarpPacket(threadFront, { packet }) {
  const { point, frames, environment } = packet;
  const expected = gPausePackets.get(pointToString(point));
  const received = { frames, environment };
  if (compareObjects(expected, received)) {
    ChromeUtils.recordReplayLog("InstantWarp packets match!");
  } else {
    ChromeUtils.recordReplayLog("Error: InstantWarp packets mismatch");
  }
}

function canInstantStep(point, limit) {
  /*
  if (!point) {
    return null;
  }
  const entries = gStepTargets.get(pointToString(point));
  const target = entries && entries[limit];
  if (!target) {
    return null;
  }
  const info = gPausePackets.get(pointToString(target));
  if (info) {
    const { frames, environment } = info;
    const thread = clientCommands.getMainThread();
    return {
      executionPoint: target,
      frames: frames.map((frame, i) => createFrame(thread, frame, i)),
      environment,
    };
  }
  */
  return null;
}

function locationKey({ sourceId, line, column }) {
  return `${sourceId}:${line}:${column}`;
}

// location => mapping
const gLocationMaps = new Map();

// sourceId => MappedSourceLocations
const gMappedLocationsBySourceId = new Map();

function MappedSourceLocations() {
  // Whether this source is actively being remapped.
  this.remapping = false;

  // The number of times this source has started remapping. At most one, probably.
  this.numRemappings = 0;

  // Locations in this source that mappings have been cached for.
  this.locations = [];
}

function getMappedSourceLocations(sourceId) {
  if (!gMappedLocationsBySourceId.has(sourceId)) {
    gMappedLocationsBySourceId.set(sourceId, new MappedSourceLocations());
  }
  return gMappedLocationsBySourceId.get(sourceId);
}

async function addMappedLocation(location) {
  const key = locationKey(location);
  if (gLocationMaps.has(key)) {
    return;
  }

  const info = getMappedSourceLocations(location.sourceId);

  // Remap the location, watching out for the case when the source is remapped
  // while we're waiting and regenerating the mapping in that case.
  let mapped;
  while (true) {
    if (info.remapping) {
      // This mapping will be added after the source is remapped.
      info.locations.push(location);
      return;
    }

    const numRemappings = info.numRemappings;
    mapped = await panel.toolbox.sourceMapService.getOriginalLocation(location);
    if (numRemappings == info.numRemappings) {
      break;
    }
  }

  gLocationMaps.set(key, mapped);
  info.locations.push(location);
}

function maybeMappedLocation(location) {
  return gLocationMaps.get(locationKey(location));
}

function sourceRemapStart(sourceId) {
  const info = getMappedSourceLocations(sourceId);
  if (info.remapping) {
    throw new Error("Remapping for source already in progress");
  }
  info.remapping = true;
  info.numRemappings++;

  for (const location of info.locations) {
    gLocationMaps.delete(locationKey(location));
  }
}

function sourceRemapEnd(sourceId) {
  const info = getMappedSourceLocations(sourceId);
  if (!info.remapping) {
    throw new Error("Source is not being remapped");
  }
  info.remapping = false;

  const locations = info.locations;
  info.locations = [];
  locations.forEach(addMappedLocation);
}

// locations -> scopes
const gLocationScopes = new Map();

// source ID -> location[]
const gPendingLocationScopes = new Map();

const gLoadedSourceIds = new Set();

async function addScopes(location) {
  if (!gLoadedSourceIds.has(location.sourceId)) {
    const existing = gPendingLocationScopes.get(location.sourceId);
    if (existing) {
      if (!existing.some(l => l.line == location.line && l.column == location.column)) {
        existing.push(location);
      }
    } else {
      gPendingLocationScopes.set(location.sourceId, [location]);
    }
    return;
  }

  const key = locationKey(location);
  if (gLocationScopes.has(key)) {
    return;
  }

  const scopes = await panel.parserDispatcher.getScopes(location);
  gLocationScopes.set(key, scopes);
}

function maybeScopes(location) {
  return gLocationScopes.get(locationKey(location));
}

function sourceLoaded(sourceId) {
  gLoadedSourceIds.add(sourceId);
  const pending = gPendingLocationScopes.get(sourceId);
  if (pending) {
    gPendingLocationScopes.delete(sourceId);
    pending.forEach(addScopes);
  }
}

const clientEvents = {
  paused,
  resumed,
  newSource,
  replayFramePositions,
  replayPreloadedData,
  instantWarpPacket,
};

const eventMethods = {
  canInstantStep,
  maybeMappedLocation,
  addMappedLocation,
  maybeScopes,
  addScopes,
  sourceLoaded,
  onSourceActorRegister,
  sourceRemapStart,
  sourceRemapEnd,
};

export {
  removeEventsTopTarget,
  setupEvents,
  clientEvents,
  addThreadEventListeners,
  eventMethods,
};

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Component } = require("react");
const ReactDOM = require("react-dom");
const dom = require("react-dom-factories");
const PropTypes = require("react-prop-types");
const { sortBy, range } = require("lodash");
const {
  pointEquals,
  pointPrecedes,
} = require("protocol/execution-point-utils.js");
const { SVG } = require("image/svg");

const { LocalizationHelper } = require("devtools/shared/l10n");
const L10N = new LocalizationHelper(
  "devtools/client/locales/toolbox.properties"
);

const getFormatStr = (key, a) => L10N.getFormatStr(`toolbox.replay.${key}`, a);

const { div } = dom;

const markerWidth = 7;
const imgDir = "devtools/skin/images";
const shouldLog = false;

function classname(name, bools) {
  for (const key in bools) {
    if (bools[key]) {
      name += ` ${key}`;
    }
  }

  return name;
}

function log(message) {
  if (shouldLog) {
    console.log(message);
  }
}

function isError(message) {
  return message.source === "javascript" && message.level === "error";
}

function CommandButton({ img, className, onClick, active }) {
  const images = {
    next: SVG.NextButton,
    previous: SVG.NextButton,
    pause: SVG.ReplayPause,
    play: SVG.ReplayResume,
    zoomout: SVG.ZoomOut,
  };

  const attrs = {
    className: classname(`command-button ${className}`, { active }),
    onClick,
  };

  attrs.title = L10N.getStr(`toolbox.replay.${img}`);

  const base64 = btoa(images[img]);

  return dom.div(
    attrs,
    dom.div({
      className: `btn ${img} ${className}`,
      style: {
        backgroundImage: `url("data:image/svg+xml;base64,${base64}")`,
      },
    })
  );
}

function getMessageProgress(message) {
  return getProgress(message.executionPoint);
}

function getProgress(executionPoint) {
  return executionPoint && executionPoint.progress;
}

function getClosestMessage(messages, executionPoint) {
  const progress = getProgress(executionPoint);

  return sortBy(messages, (message) =>
    Math.abs(progress - getMessageProgress(message))
  )[0];
}

function sameLocation(m1, m2) {
  const f1 = m1.frame;
  const f2 = m2.frame;

  return (
    f1.source === f2.source && f1.line === f2.line && f1.column === f2.column
  );
}

function getMessageLocation(message) {
  if (!message.frame) {
    return null;
  }
  const {
    frame: { source, line, column },
  } = message;
  return { sourceUrl: source, line, column };
}

const FirstCheckpointId = 1;
const FirstCheckpointExecutionPoint = {
  checkpoint: FirstCheckpointId,
  progress: 0,
};

// Information about the progress and time at each checkpoint. This only grows,
// and is not part of the reducer store so we can update it without rerendering.
const gCheckpoints = [
  null,
  { point: FirstCheckpointExecutionPoint, time: 0, widgetEvents: [] },
];

function checkpointInfo(checkpoint) {
  if (!gCheckpoints[checkpoint]) {
    console.error(`WebReplayPlayer missing checkpoint ${checkpoint}`);
  }
  return gCheckpoints[checkpoint];
}

function executionPointTime(point) {
  let previousInfo = gCheckpoints[point.checkpoint];
  if (!previousInfo) {
    // We might pause at a checkpoint before we've received its information.
    return recordingEndTime();
  }
  if (!gCheckpoints[point.checkpoint + 1]) {
    return previousInfo.time;
  }
  let nextInfo = gCheckpoints[point.checkpoint + 1];

  function newPoint(info) {
    if (
      pointPrecedes(previousInfo.point, info.point) &&
      !pointPrecedes(point, info.point)
    ) {
      previousInfo = info;
    }
    if (
      pointPrecedes(info.point, nextInfo.point) &&
      pointPrecedes(point, info.point)
    ) {
      nextInfo = info;
    }
  }

  gCheckpoints[point.checkpoint].widgetEvents.forEach(newPoint);

  if (pointEquals(point, previousInfo.point)) {
    return previousInfo.time;
  }

  const previousProgress = previousInfo.progress;
  const nextProgress = nextInfo.progress;
  const fraction =
    (point.progress - previousProgress) / (nextProgress - previousProgress);
  if (Number.isNaN(fraction)) {
    return previousInfo.time;
  }
  return previousInfo.time + fraction * (nextInfo.time - previousInfo.time);
}

function recordingEndTime() {
  return gCheckpoints[gCheckpoints.length - 1].time;
}

function similarPoints(p1, p2) {
  const time1 = executionPointTime(p1);
  const time2 = executionPointTime(p2);
  return Math.abs(time1 - time2) / recordingEndTime() < 0.001;
}

function binarySearch(start, end, callback) {
  while (start + 1 < end) {
    const mid = ((start + end) / 2) | 0;
    const rv = callback(mid);
    if (rv < 0) {
      end = mid;
    } else {
      start = mid;
    }
  }
  return start;
}

/*
 *
 * The player has 4 valid states
 * - Paused:       (paused, !recording, !seeking)
 * - Playing:      (!paused, !recording, !seeking)
 * - Seeking:      (!paused, !recording, seeking)
 * - Recording:    (!paused, recording, !seeking)
 *
 */
class WebReplayPlayer extends Component {
  static get propTypes() {
    return {
      toolbox: PropTypes.object,
    };
  }

  constructor(props) {
    super(props);
    this.state = {
      executionPoint: FirstCheckpointExecutionPoint,
      recordingEndpoint: FirstCheckpointExecutionPoint,
      hoverPoint: null,
      startDragPoint: null,
      seeking: false,
      recording: true,
      paused: false,
      playback: null,
      messages: [],
      highlightedMessage: null,
      hoveredMessageOffset: null,
      unscannedRegions: [],
      shouldAnimate: true,
      zoomStartpoint: FirstCheckpointExecutionPoint,
      zoomEndpoint: FirstCheckpointExecutionPoint,
      recordingDuration: 0,
    };

    this.hoveredMessage = null;
    this.overlayWidth = 1;

    this.onProgressBarMouseMove = this.onProgressBarMouseMove.bind(this);
    this.onPlayerMouseLeave = this.onPlayerMouseLeave.bind(this);
    this.onPlayerMouseDown = this.onPlayerMouseDown.bind(this);
    this.onPlayerMouseUp = this.onPlayerMouseUp.bind(this);
  }

  componentDidMount() {
    this.overlayWidth = this.updateOverlayWidth();
    this.threadFront.ensureProcessed(
      this.onMissingRegions.bind(this),
      this.onUnprocessedRegions.bind(this)
    );
    this.threadFront.findPaints(this.onPaints.bind(this));
    this.threadFront.findMouseEvents(this.onMouseEvents.bind(this));

    this.toolbox.getPanelWhenReady("webconsole").then((panel) => {
      const consoleFrame = panel.hud.ui;
      consoleFrame.on("message-hover", this.onConsoleMessageHover.bind(this));
      consoleFrame.wrapper.subscribeToStore(this.onConsoleUpdate.bind(this));
    });

    this.toolbox.webReplayPlayer = this;
  }

  componentDidUpdate(prevProps, prevState) {
    this.overlayWidth = this.updateOverlayWidth();

    if (prevState.closestMessage != this.state.closestMessage) {
      this.scrollToMessage(this.state.closestMessage);
    }
  }

  setRecordingDuration(duration) {
    this.setState({ recordingDuration: duration });
  }

  get toolbox() {
    return this.props.toolbox;
  }

  get console() {
    return this.toolbox.getPanel("webconsole");
  }

  get threadFront() {
    return this.toolbox.threadFront;
  }

  isRecording() {
    return !this.isPaused() && this.state.recording;
  }

  isPaused() {
    return this.state.paused;
  }

  isSeeking() {
    return this.state.seeking;
  }

  getTickSize() {
    const { zoomStartpoint, zoomEndpoint } = this.state;
    const zoomStartTime = executionPointTime(zoomStartpoint);
    const zoomEndTime = executionPointTime(zoomEndpoint);

    const minSize = 10;

    if (zoomStartTime == zoomEndTime) {
      return minSize;
    }

    const maxSize = this.overlayWidth / 10;
    const ratio = (zoomEndTime - zoomStartTime) / recordingEndTime();
    return (1 - ratio) * maxSize + minSize;
  }

  getClosestMessage(point) {
    return getClosestMessage(this.state.messages, point);
  }

  // Get the time for a mouse event within the recording.
  getMouseTime(e) {
    const { zoomStartpoint, zoomEndpoint } = this.state;

    const zoomStartTime = executionPointTime(zoomStartpoint);
    const zoomEndTime = executionPointTime(zoomEndpoint);

    const { left, width } = e.currentTarget.getBoundingClientRect();
    const clickLeft = e.clientX;

    const clickPosition = (clickLeft - left) / width;
    return zoomStartTime + (zoomEndTime - zoomStartTime) * clickPosition;
  }

  onPaused(packet) {
    if (packet) {
      let { executionPoint } = packet;
      const closestMessage = this.getClosestMessage(executionPoint);

      let pausedMessage;
      if (executionPoint) {
        pausedMessage = this.state.messages
          .filter((message) => message.executionPoint)
          .find((message) =>
            pointEquals(message.executionPoint, executionPoint)
          );
      } else {
        executionPoint = this.state.executionPoint;
      }

      this.setState({
        executionPoint,
        paused: true,
        seeking: false,
        recording: false,
        closestMessage,
        pausedMessage,
      });
    }
  }

  onResumed(packet) {
    this.setState({ paused: false, closestMessage: null, pausedMessage: null });
  }

  onMissingRegions(regions) {
    console.log("MissingRegions", regions);
  }

  onUnprocessedRegions(regions) {
    console.log("UnprocessedRegions", regions);
  }

  onPaints(paints) {
    console.log("PlayerPaints", paints);
  }

  onMouseEvents(events) {
    console.log("OnMouseEvents", events);
  }

  onConsoleUpdate(consoleState) {
    const {
      messages: { visibleMessages, messagesById },
    } = consoleState;

    if (visibleMessages != this.state.visibleMessages) {
      let messages = visibleMessages
        .map((id) => messagesById.get(id))
        .filter(
          (message) => message.source == "console-api" || isError(message)
        );

      messages = sortBy(messages, (message) => getMessageProgress(message));

      this.setState({ messages, visibleMessages, shouldAnimate: false });
    }
  }

  onConsoleMessageHover(type, message) {
    if (type == "mouseleave") {
      return this.setState({ highlightedMessage: null });
    }

    if (type == "mouseenter") {
      return this.setState({ highlightedMessage: message.id });
    }

    return null;
  }

  setTimelinePosition({ point, direction }) {
    this.setState({ [direction]: point });
  }

  findMessage(message) {
    const consoleOutput = this.console.hud.ui.outputNode;
    return consoleOutput.querySelector(
      `.message[data-message-id="${message.id}"]`
    );
  }

  scrollToMessage(message) {
    if (!message) {
      return;
    }

    const element = this.findMessage(message);
    const consoleOutput = this.console.hud.ui.outputNode;

    if (element) {
      const consoleHeight = consoleOutput.getBoundingClientRect().height;
      const elementTop = element.getBoundingClientRect().top;
      if (elementTop < 30 || elementTop + 50 > consoleHeight) {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }

  unhighlightConsoleMessage() {
    if (this.hoveredMessage) {
      this.hoveredMessage.classList.remove("highlight");
    }
  }

  highlightConsoleMessage(message) {
    if (!message) {
      return;
    }

    const element = this.findMessage(message);
    if (!element) {
      return;
    }

    this.unhighlightConsoleMessage();
    element.classList.add("highlight");
    this.hoveredMessage = element;
  }

  showMessage(message) {
    this.highlightConsoleMessage(message);
    this.scrollToMessage(message);
  }

  onMessageMouseEnter(message, offset) {
    this.setState({ hoveredMessageOffset: offset });
    this.previewLocation(message);
    this.showMessage(message);
  }

  onMessageMouseLeave() {
    this.setState({ hoveredMessageOffset: null });
    this.clearPreviewLocation();
  }

  async previewLocation(closestMessage) {
    const dbg = await this.toolbox.loadTool("jsdebugger");
    const location = getMessageLocation(closestMessage);
    if (location) {
      dbg.previewPausedLocation(location);
    }
  }

  async clearPreviewLocation() {
    const dbg = await this.toolbox.loadTool("jsdebugger");
    dbg.clearPreviewPausedLocation();
  }

  onProgressBarMouseMove(e) {
    if (gCheckpoints.length == 1) {
      return;
    }

    const { hoverPoint } = this.state;
    const time = this.getMouseTime(e);

    let checkpoint = binarySearch(1, gCheckpoints.length, (checkpoint) => {
      return time - checkpointInfo(checkpoint).time;
    });

    let closestPoint = checkpointInfo(checkpoint).point;
    let closestTime = checkpointInfo(checkpoint).time;

    function newPoint(info) {
      if (Math.abs(time - info.time) < Math.abs(time - closestTime)) {
        closestPoint = info.point;
        closestTime = info.time;
      }
    }

    checkpointInfo(checkpoint).widgetEvents.forEach(newPoint);
    if (checkpoint + 1 < gCheckpoints.length) {
      newPoint(checkpointInfo(checkpoint + 1));
    }

    if (!hoverPoint || !pointEquals(closestPoint, hoverPoint)) {
      this.threadFront.paint(closestPoint);
      this.setState({ hoverPoint: closestPoint });
    }
  }

  onPlayerMouseLeave() {
    this.unhighlightConsoleMessage();
    this.clearPreviewLocation();
    this.threadFront.paintCurrentPoint();

    this.setState({ hoverPoint: null, startDragPoint: null });
  }

  onPlayerMouseDown() {
    const { hoverPoint } = this.state;
    if (hoverPoint) {
      this.setState({ startDragPoint: hoverPoint });
    }
  }

  zoomedRegion() {
    const { startDragPoint, hoverPoint } = this.state;
    if (!startDragPoint || !hoverPoint) {
      return null;
    }
    const dragPos = this.getVisiblePosition(startDragPoint);
    const hoverPos = this.getVisiblePosition(hoverPoint);
    if (Math.abs(dragPos - hoverPos) < 0.02) {
      return null;
    }
    if (dragPos < hoverPos) {
      return { zoomStartpoint: startDragPoint, zoomEndpoint: hoverPoint };
    }
    return { zoomStartpoint: hoverPoint, zoomEndpoint: startDragPoint };
  }

  onPlayerMouseUp(e) {
    const { hoverPoint, startDragPoint, executionPoint } = this.state;
    this.setState({ startDragPoint: null });

    const zoomInfo = this.zoomedRegion();
    if (zoomInfo) {
      const { zoomStartpoint, zoomEndpoint } = zoomInfo;
      this.setState({ zoomStartpoint, zoomEndpoint });

      if (pointPrecedes(executionPoint, zoomStartpoint)) {
        this.seek(zoomStartpoint);
      } else if (pointPrecedes(zoomEndpoint, executionPoint)) {
        this.seek(zoomEndpoint);
      }
    } else if (e.altKey) {
      const direction = e.shiftKey ? "zoomEndpoint" : "zoomStartpoint";
      this.setTimelinePosition({ point: hoverPoint, direction });
    } else if (startDragPoint && hoverPoint) {
      this.setState({ seeking: true });
      this.threadFront.timeWarp(hoverPoint);
    }
  }

  seek(executionPoint) {
    if (!executionPoint) {
      return null;
    }

    // set seeking to the current execution point to avoid a progress bar jump
    this.setState({ seeking: true });
    return this.threadFront.timeWarp(executionPoint);
  }

  doPrevious() {
    const point = this.state.executionPoint;

    let checkpoint = point.checkpoint;
    if (pointEquals(checkpoint, point)) {
      if (checkpoint == FirstCheckpointId) {
        return;
      }
      checkpoint--;
    }

    let newPoint = checkpointInfo(checkpoint).point;
    if (pointPrecedes(newPoint, this.state.zoomStartpoint)) {
      newPoint = this.state.zoomStartpoint;
    }

    this.seek(newPoint);
  }

  doNext() {
    const point = this.state.executionPoint;
    if (pointEquals(point, this.state.zoomEndpoint)) {
      return;
    }

    let nextPoint = checkpointInfo(point.checkpoint + 1).point;
    if (pointPrecedes(this.state.zoomEndpoint, nextPoint)) {
      nextPoint = this.state.zoomEndpoint;
    }

    this.seek(nextPoint);
  }

  nextPlaybackPoint(point) {
    if (pointEquals(point, this.state.zoomEndpoint)) {
      return null;
    }

    const time = executionPointTime(point);
    let nextPoint = checkpointInfo(point.checkpoint + 1).point;

    const { widgetEvents } = checkpointInfo(point.checkpoint);
    for (const event of widgetEvents) {
      if (pointPrecedes(point, event.point) && event.time >= time + 100) {
        nextPoint = event.point;
        break;
      }
    }

    if (pointPrecedes(this.state.zoomEndpoint, nextPoint)) {
      nextPoint = this.state.zoomEndpoint;
    }

    return nextPoint;
  }

  replayPaintFinished({ point }) {
    if (this.state.playback && pointEquals(point, this.state.playback.point)) {
      const next = this.nextPlaybackPoint(point);
      if (next) {
        ChromeUtils.recordReplayLog(`WebReplayPlayer PlaybackNext`);
        this.threadFront.paint(next);
        this.setState({ playback: { point: next }, executionPoint: next });
      } else {
        ChromeUtils.recordReplayLog(`WebReplayPlayer StopPlayback`);
        this.seek(point);
        this.setState({ playback: null });
      }
    }
  }

  startPlayback() {
    ChromeUtils.recordReplayLog(`WebReplayPlayer StartPlayback`);

    let point = this.nextPlaybackPoint(this.state.executionPoint);
    if (!point) {
      point = this.state.zoomStartpoint;
    }
    this.threadFront.paint(point);

    this.setState({ playback: { point }, executionPoint: point });
  }

  stopPlayback() {
    ChromeUtils.recordReplayLog(`WebReplayPlayer StopPlayback`);

    if (this.state.playback && this.state.playback.point) {
      this.seek(this.state.playback.point);
    }
    this.setState({ playback: null });
  }

  doZoomOut() {
    this.setState({
      zoomStartpoint: FirstCheckpointExecutionPoint,
      zoomEndpoint: this.state.recordingEndpoint,
    });
  }

  renderCommands() {
    const paused = this.isPaused();
    const {
      playback,
      zoomStartpoint,
      zoomEndpoint,
      recordingEndpoint,
    } = this.state;

    const zoomed =
      !pointEquals(zoomStartpoint, FirstCheckpointExecutionPoint) ||
      !pointEquals(zoomEndpoint, recordingEndpoint);

    return [
      CommandButton({
        className: "",
        active: paused && !playback,
        img: "previous",
        onClick: () => this.doPrevious(),
      }),

      CommandButton({
        className: "primary",
        active: paused,
        img: playback ? "pause" : "play",
        onClick: () => (playback ? this.stopPlayback() : this.startPlayback()),
      }),

      CommandButton({
        className: "",
        active: paused && !playback,
        img: "next",
        onClick: () => this.doNext(),
      }),

      CommandButton({
        className: "",
        active: zoomed,
        img: "zoomout",
        onClick: () => this.doZoomOut(),
      }),
    ];
  }

  updateOverlayWidth() {
    const el = ReactDOM.findDOMNode(this).querySelector(".progressBar");
    return el ? el.clientWidth : 1;
  }

  // calculate pixel distance from two points
  getPixelDistance(to, from) {
    const toPos = this.getVisiblePosition(to);
    const fromPos = this.getVisiblePosition(from);

    return (toPos - fromPos) * this.overlayWidth;
  }

  // Get the position of an execution point on the visible part of the timeline,
  // in the range [0, 1].
  getVisiblePosition(executionPoint) {
    const { zoomStartpoint, zoomEndpoint } = this.state;

    if (!executionPoint) {
      return 0;
    }

    const zoomStartTime = executionPointTime(zoomStartpoint);
    const zoomEndTime = executionPointTime(zoomEndpoint);
    const time = executionPointTime(executionPoint);

    if (time < zoomStartTime) {
      return 0;
    }

    if (time >= zoomEndTime) {
      return 1;
    }

    return (time - zoomStartTime) / (zoomEndTime - zoomStartTime);
  }

  // Get the pixel offset for an execution point.
  getPixelOffset(point) {
    return this.getVisiblePosition(point) * this.overlayWidth;
  }

  renderMessage(message, index) {
    const {
      messages,
      executionPoint,
      pausedMessage,
      highlightedMessage,
    } = this.state;

    const offset = this.getPixelOffset(message.executionPoint);
    const previousMessage = messages[index - 1];

    if (offset < 0) {
      return null;
    }

    // Check to see if two messages overlay each other on the timeline
    const isOverlayed =
      previousMessage &&
      this.getPixelDistance(
        message.executionPoint,
        previousMessage.executionPoint
      ) < markerWidth;

    // Check to see if a message appears after the current execution point
    const isFuture =
      this.getPixelDistance(message.executionPoint, executionPoint) >
      markerWidth / 2;

    const isHighlighted = highlightedMessage == message.id;

    const atPausedLocation =
      pausedMessage && sameLocation(pausedMessage, message);

    let frameLocation = "";
    if (message.frame) {
      const { source, line, column } = message.frame;
      const filename = source.split("/").pop();
      frameLocation = `${filename}:${line}`;
      if (column > 100) {
        frameLocation += `:${column}`;
      }
    }

    return dom.a({
      className: classname("message", {
        overlayed: isOverlayed,
        future: isFuture,
        highlighted: isHighlighted,
        location: atPausedLocation,
      }),
      style: {
        left: `${Math.max(offset - markerWidth / 2, 0)}px`,
        zIndex: `${index + 100}`,
      },
      title: getFormatStr("jumpMessage2", frameLocation),
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.seek(message.executionPoint);
      },
      onMouseEnter: () => this.onMessageMouseEnter(message, offset),
      onMouseLeave: () => this.onMessageMouseLeave(),
    });
  }

  renderMessages() {
    const messages = this.state.messages;
    return messages.map((message, index) => this.renderMessage(message, index));
  }

  renderHoverPoint() {
    const { hoverPoint, hoveredMessageOffset } = this.state;
    if (!hoverPoint || hoveredMessageOffset) {
      return [];
    }
    const offset = this.getPixelOffset(hoverPoint);
    return [
      dom.span({
        className: "hoverPoint",
        style: {
          left: `${Math.max(offset - markerWidth / 2, 0)}px`,
          zIndex: 1000,
        },
      }),
    ];
  }

  renderTicks() {
    const tickSize = this.getTickSize();
    const ticks = Math.round(this.overlayWidth / tickSize);
    return range(ticks).map((value, index) => this.renderTick(index));
  }

  renderTick(index) {
    const { executionPoint, hoveredMessageOffset } = this.state;
    const tickSize = this.getTickSize();
    const offset = Math.round(this.getPixelOffset(executionPoint));
    const position = index * tickSize;
    const isFuture = position > offset;
    const shouldHighlight = hoveredMessageOffset > position;

    return dom.span({
      className: classname("tick", {
        future: isFuture,
        highlight: shouldHighlight,
      }),
      style: {
        left: `${position}px`,
        width: `${tickSize}px`,
      },
    });
  }

  renderUnscannedRegions() {
    return this.state.unscannedRegions.map(
      this.renderUnscannedRegion.bind(this)
    );
  }

  renderUnscannedRegion({ start, end, traversed }) {
    let startOffset = this.getPixelOffset(start);
    let endOffset = this.getPixelOffset(end);

    if (startOffset >= this.overlayWidth || endOffset <= 0) {
      return null;
    }

    if (startOffset < 0) {
      startOffset = 0;
    }

    if (endOffset > this.overlayWidth) {
      endOffset = this.overlayWidth;
    }

    return dom.span({
      className: traversed ? "unscanned" : "untraversed",
      style: {
        left: `${startOffset}px`,
        width: `${endOffset - startOffset}px`,
      },
    });
  }

  renderZoomedRegion() {
    const info = this.zoomedRegion();
    if (!info) {
      return [];
    }

    let startOffset = this.getPixelOffset(info.zoomStartpoint);
    let endOffset = this.getPixelOffset(info.zoomEndpoint);

    return [
      dom.span({
        className: "untraversed",
        style: {
          left: "0px",
          width: `${startOffset}px`,
        },
      }),
      dom.span({
        className: "untraversed",
        style: {
          left: `${endOffset}px`,
          width: `${this.overlayWidth - endOffset}px`,
        },
      }),
    ];
  }

  renderZoomBoundary(start) {
    const point = start ? this.state.zoomStartpoint : this.state.zoomEndpoint;
    const base = start
      ? FirstCheckpointExecutionPoint
      : this.state.recordingEndpoint;
    if (pointEquals(point, base)) {
      return [];
    }
    const title = L10N.getStr(
      `toolbox.replay.zoomBoundary${start ? "Start" : "End"}`
    );
    const time = executionPointTime(point);
    const percent = ((time / recordingEndTime()) * 100) | 0;
    return [dom.span({ className: "zoomboundary", title }, `${percent}%`)];
  }

  render() {
    const percent = this.getVisiblePosition(this.state.executionPoint) * 100;

    const recording = this.isRecording();
    const { shouldAnimate } = this.state;
    return div(
      {
        className: "webreplay-player",
      },
      div(
        {
          id: "overlay",
          className: classname("", {
            recording: recording,
            paused: !recording,
          }),
        },
        div(
          {
            className: classname("overlay-container", {
              animate: shouldAnimate,
            }),
          },
          div({ className: "commands" }, ...this.renderCommands()),
          // this.renderZoomBoundary(true),
          div(
            {
              className: "progressBar",
              onMouseMove: this.onProgressBarMouseMove,
              onMouseLeave: this.onPlayerMouseLeave,
              onMouseDown: this.onPlayerMouseDown,
              onMouseUp: this.onPlayerMouseUp,
            },
            div({
              className: "progress",
              style: { width: `${percent}%` },
            }),
            div({
              className: "progress-line",
              style: { width: `${percent}%` },
            }),
            div({
              className: "progress-line end",
              style: { left: `${percent}%`, width: `${100 - percent}%` },
            }),
            ...this.renderMessages(),
            ...this.renderHoverPoint(),
            ...this.renderTicks(),
            ...this.renderUnscannedRegions(),
            ...this.renderZoomedRegion()
          )
          // this.renderZoomBoundary(false)
        )
      )
    );
  }
}

module.exports = WebReplayPlayer;

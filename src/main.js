/*
BSD 3-Clause License

Copyright (c) 2020, Web Replay LLC
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

window.loader = {
  lazyRequireGetter() { },
  lazyGetter() { },
};

require("./styles.css");

const React = require("react");
const ReactDOM = require("react-dom");
const WebReplayPlayer = require("ui/components/WebReplayPlayer");
import App from "ui/components/App";

const { initSocket, sendMessage, log } = require("protocol/socket");
const { ThreadFront } = require("protocol/thread");
const { paintMessage } = require("protocol/graphics");
const { throttle, clamp, EventEmitter } = require("protocol/utils");
const { DebuggerPanel } = require("devtools/client/debugger/panel");
const { WebConsolePanel } = require("devtools/client/webconsole/panel");
const { InspectorPanel } = require("devtools/client/inspector/panel");
const Selection = require("devtools/client/framework/selection");
const loadImages = require("image/image");

const { LocalizationHelper } = require("shims/l10n");

// Instantiate preferences early on from this rather obscure file...
require("devtools/client/debugger/src/utils/prefs");

window.l10n = new LocalizationHelper(
  "devtools/client/locales/debugger.properties"
);

window.PrefObserver = function () { };
window.PrefObserver.prototype = {
  on: () => { },
  off: () => { },
};

const url = new URL(window.location.href);

const recordingId = url.searchParams.get("id");
const dispatch = url.searchParams.get("dispatch");
const test = url.searchParams.get("test");

if (test) {
  localStorage.clear();
  require("devtools-modules").asyncStorage.clear();
}


async function initialize() {
  if (!recordingId) {
    paintMessage("Recording ID not specified");
    return;
  }

  initSocket(dispatch);

  paintMessage("");

  sendMessage("Recording.getDescription", { recordingId }).then(
    (description) => {
      gToolbox.webReplayPlayer.setRecordingDescription(description);
    }
  );

  sendMessage("Recording.createSession", { recordingId }).then(
    async ({ sessionId }) => {
      ThreadFront.setSessionId(sessionId);
      if (test) {
        await gToolbox.loadTool("jsdebugger");
        window.Test = require("./test/harness");
        ThreadFront.setTest(test);
      }
    }
  );

  loadImages();
  setupToolboxResizeEventHandlers();

  document.body.addEventListener("contextmenu", e => e.preventDefault());

  // Set the current mouse position on the window. This is used in places where
  // testing element.matches(":hover") does not work right for some reason.
  document.body.addEventListener("mousemove", e => {
    window.mouseClientX = e.clientX;
    window.mouseClientY = e.clientY;
  });
  window.elementIsHovered = elem => {
    const { left, top, right, bottom } = elem.getBoundingClientRect();
    const { mouseClientX, mouseClientY } = window;
    return left <= mouseClientX &&
      mouseClientX <= right &&
      top <= mouseClientY &&
      mouseClientY <= bottom;
  };
}

const gToolbox = {
  currentTool: null,

  _panels: {},

  getPanel(name) {
    return this._panels[name];
  },

  async getPanelWhenReady(name) {
    const panel = this.getPanel(name);
    await panel.readyWaiter.promise;
    return panel;
  },

  threadFront: ThreadFront,

  selection: new Selection(),
  nodePicker: {},

  getHighlighter() {
    return {};
  },

  addTool(name, panel) {
    this._panels[name] = panel;
    const button = document.getElementById(`toolbox-toolbar-${name}`);
    button.addEventListener("click", () => this.selectTool(name));
  },

  loadTool(name) {
    return this.getPanelWhenReady(name);
  },

  selectTool(name) {
    if (name == this.currentTool) {
      return;
    }
    log(`Toolbox SelectTool ${name}`);
    this.currentTool = name;
    const toolbox = document.getElementById(`toolbox`);
    toolbox.classList = name;
    this.emit("select", name);
  },

  async viewSourceInDebugger(url, line, column, id) {
    const dbg = this.getPanel("jsdebugger");
    const source = id ? dbg.getSourceByActorId(id) : dbg.getSourceByURL(url);
    if (source) {
      this.selectTool("jsdebugger");
      dbg.selectSource(source.id, line, column);
    }
  },

  parserService: {
    hasSyntaxError: (text) => false,
  },

  // Helpers for debugging.
  webconsoleState() {
    return gToolbox.webconsoleHud.ui.wrapper.getStore().getState();
  },
};

EventEmitter.decorate(gToolbox);
EventEmitter.decorate(gToolbox.nodePicker);

window.gToolbox = gToolbox;

setTimeout(async () => {
  // Wait for CodeMirror to load asynchronously.
  while (!window.CodeMirror) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  ReactDOM.render(React.createElement(App, { initialize }), document.body);

  const debuggerPanel = new DebuggerPanel(gToolbox);
  gToolbox.addTool("jsdebugger", debuggerPanel);

  const consolePanel = new WebConsolePanel(gToolbox);
  gToolbox.addTool("webconsole", consolePanel);

  const inspectorPanel = new InspectorPanel(gToolbox);
  gToolbox.addTool("inspector", inspectorPanel);

  const timeline = React.createElement(WebReplayPlayer, { toolbox: gToolbox });
  ReactDOM.render(timeline, document.getElementById("toolbox-timeline"));

  debuggerPanel.open();
  consolePanel.open();
  inspectorPanel.open();

  gToolbox.selectTool("jsdebugger");
}, 0);

function setupToolboxResizeEventHandlers() {
  const toolbox = document.getElementById("toolbox");

  let clientY;
  const updateToolbox = throttle(() => {
    const percent = 100 * clientY / window.innerHeight;
    toolbox.style.top = `${percent}%`;
    toolbox.style.height = `${100 - percent}%`;
  }, 100);

  let dragging = false;

  const border = document.getElementById("toolbox-border");
  const minimumHeight = 40;

  border.addEventListener("mousedown", () => {
    if (dragging) {
      return;
    }
    dragging = true;

    function onMouseMove(e) {
      clientY = clamp(e.clientY, 0, window.innerHeight - minimumHeight);
      updateToolbox();
    }

    function onMouseUp(e) {
      clientY = clamp(e.clientY, 0, window.innerHeight - minimumHeight);
      updateToolbox();

      dragging = false;

      document.body.style.cursor = "default";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.body.style.cursor = "row-resize";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

const { LocalizationHelper } = require("devtools/shared/l10n");
const { defer, assert } = require("protocol/utils");

/*
loader.lazyRequireGetter(
  this,
  "openContentLink",
  "devtools/client/shared/link",
  true
);
loader.lazyRequireGetter(
  this,
  "features",
  "devtools/client/debugger/src/utils/prefs",
  true
);
*/

const DBG_STRINGS_URI = "devtools/client/locales/debugger.properties";
const L10N = new LocalizationHelper(DBG_STRINGS_URI);

function registerStoreObserver(store, subscriber) {
  let oldState = store.getState();
  store.subscribe(() => {
    const state = store.getState();
    subscriber(state, oldState);
    oldState = state;
  });
}

function DebuggerPanel(toolbox) {
  this.panelWin = window;
  this.panelWin.L10N = L10N;
  this.panelWin.Debugger = require("./src/main").default;

  this.toolbox = toolbox;
  this.readyWaiter = defer();
}

async function getNodeFront(gripOrFront, toolbox) {
  // Given a NodeFront
  if ("actorID" in gripOrFront) {
    return new Promise(resolve => resolve(gripOrFront));
  }

  const inspectorFront = await toolbox.target.getFront("inspector");
  return inspectorFront.getNodeFrontFromNodeGrip(gripOrFront);
}

DebuggerPanel.prototype = {
  open: async function () {
    const {
      actions,
      store,
      selectors,
      client,
    } = await this.panelWin.Debugger.bootstrap({
      workers: {
        sourceMaps: this.toolbox.sourceMapService,
        evaluationsParser: this.toolbox.parserService,
      },
      panel: this,
    });

    this._actions = actions;
    this._store = store;
    this._selectors = selectors;
    this._client = client;
    this.isReady = true;
    this.readyWaiter.resolve();

    registerStoreObserver(this._store, this._onDebuggerStateChange.bind(this));

    return this;
  },

  _onDebuggerStateChange(state, oldState) {
    const { getCurrentThread } = this._selectors;

    if (getCurrentThread(state) !== getCurrentThread(oldState)) {
      this.toolbox.selectThread(getCurrentThread(state));
    }
  },

  getVarsForTests() {
    assert(this.isReady);
    return {
      store: this._store,
      selectors: this._selectors,
      actions: this._actions,
      client: this._client,
    };
  },

  _getState: function () {
    return this._store.getState();
  },

  getToolboxStore: function () {
    return this.toolbox.store;
  },

  openLink: function (url) {
    openContentLink(url);
  },

  openConsoleAndEvaluate: async function (input) {
    const { hud } = await this.toolbox.selectTool("console");
    hud.ui.wrapper.dispatchEvaluateExpression(input);
  },

  openInspector: async function () {
    this.toolbox.selectTool("inspector");
  },

  openElementInInspector: async function (gripOrFront) {
    const onSelectInspector = this.toolbox.selectTool("inspector");
    const onGripNodeToFront = getNodeFront(gripOrFront, this.toolbox);

    const [front, inspector] = await Promise.all([
      onGripNodeToFront,
      onSelectInspector,
    ]);

    const onInspectorUpdated = inspector.once("inspector-updated");
    const onNodeFrontSet = this.toolbox.selection.setNodeFront(front, {
      reason: "debugger",
    });

    return Promise.all([onNodeFrontSet, onInspectorUpdated]);
  },

  highlightDomElement: async function (gripOrFront) {
    if (!this._highlight) {
      const { highlight, unhighlight } = this.toolbox.getHighlighter();
      this._highlight = highlight;
      this._unhighlight = unhighlight;
    }

    return this._highlight(gripOrFront);
  },

  unHighlightDomElement: function () {
    if (!this._unhighlight) {
      return;
    }

    const forceUnHighlightInTest = true;
    return this._unhighlight(forceUnHighlightInTest);
  },

  getFrames: function () {
    const thread = this._selectors.getCurrentThread(this._getState());
    const frames = this._selectors.getFrames(this._getState(), thread);

    // Frames is null when the debugger is not paused.
    if (!frames) {
      return {
        frames: [],
        selected: -1,
      };
    }

    const selectedFrame = this._selectors.getSelectedFrame(
      this._getState(),
      thread
    );
    const selected = frames.findIndex(frame => frame.id == selectedFrame.id);

    frames.forEach(frame => {
      frame.actor = frame.id;
    });

    return { frames, selected };
  },

  isPaused() {
    const thread = this._selectors.getCurrentThread(this._getState());
    return this._selectors.getIsPaused(this._getState(), thread);
  },

  interrupt() {
    const cx = this._selectors.getThreadContext(this._getState());
    this._actions.breakOnNext(cx);
  },

  selectSourceURL(url, line, column) {
    const cx = this._selectors.getContext(this._getState());
    return this._actions.selectSourceURL(cx, url, { line, column });
  },

  async selectWorker(workerTargetFront) {
    const threadId = workerTargetFront.threadFront.actorID;
    const isThreadAvailable = this._selectors
      .getThreads(this._getState())
      .find(x => x.actor === threadId);

    if (!features.windowlessServiceWorkers) {
      console.error(
        "Selecting a worker needs the pref debugger.features.windowless-service-workers set to true"
      );
      return;
    }

    if (!isThreadAvailable) {
      console.error(`Worker ${threadId} is not available for debugging`);
      return;
    }

    // select worker's thread
    const cx = this._selectors.getContext(this._getState());
    this._actions.selectThread(cx, threadId);

    // select worker's source
    const source = this.getSourceByURL(workerTargetFront._url);
    await this.selectSource(source.id, 1, 1);
  },

  previewPausedLocation(location) {
    return this._actions.previewPausedLocation(location);
  },

  clearPreviewPausedLocation() {
    return this._actions.clearPreviewPausedLocation();
  },

  async selectSource(sourceId, line, column) {
    const cx = this._selectors.getContext(this._getState());
    const location = { sourceId, line, column };

    await this._actions.selectSource(cx, sourceId, location);
    if (this._selectors.hasLogpoint(this._getState(), location)) {
      this._actions.openConditionalPanel(location, true);
    }
  },

  canLoadSource(sourceId) {
    return this._selectors.canLoadSource(this._getState(), sourceId);
  },

  getSourceByActorId(sourceId) {
    return this._selectors.getSourceByActorId(this._getState(), sourceId);
  },

  getSourceByURL(sourceURL) {
    return this._selectors.getSourceByURL(this._getState(), sourceURL);
  },

  destroy: function () {
    this.panelWin.Debugger.destroy();
    this.emit("destroyed");
  },
};

exports.DebuggerPanel = DebuggerPanel;

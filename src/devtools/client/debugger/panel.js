/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

import { assert } from "protocol/utils";
import { openDocLink } from "devtools/client/shared/link";
import { onConnect } from "devtools/client/debugger/src/client";
import { getCodeMirror } from "devtools/client/debugger/src/utils/editor";

export class DebuggerPanel {
  constructor(toolbox) {
    this.toolbox = toolbox;
  }

  async open() {
    const { actions, store, selectors, client } = onConnect();

    this._actions = actions;
    this._store = store;
    this._selectors = selectors;
    this._client = client;
    this.isReady = true;

    return this;
  }

  getVarsForTests() {
    assert(this.isReady);
    return {
      store: this._store,
      selectors: this._selectors,
      actions: this._actions,
      client: this._client,
    };
  }

  _getState() {
    return this._store.getState();
  }

  getToolboxStore() {
    return this.toolbox.store;
  }

  openLink(url) {
    openDocLink(url);
  }

  async openConsoleAndEvaluate(input) {
    const consolePanel = await this.toolbox.selectTool("console");
    consolePanel.evaluateExpression(input);
  }

  async openInspector() {
    this.toolbox.selectTool("inspector");
  }

  async openElementInInspector(valueFront) {
    this.toolbox.selectTool("inspector");

    const pause = valueFront.getPause();
    const nodeFront = await pause.ensureDOMFrontAndParents(valueFront._object.objectId);
    await nodeFront.ensureLoaded();

    await this.toolbox.selection.setNodeFront(nodeFront, {
      reason: "debugger",
    });
  }

  async highlightDomElement(gripOrFront) {
    if (!this._highlight) {
      const { highlight, unhighlight } = this.toolbox.getHighlighter();
      this._highlight = highlight;
      this._unhighlight = unhighlight;
    }

    return this._highlight(gripOrFront);
  }

  unHighlightDomElement() {
    if (!this._unhighlight) {
      return;
    }

    const forceUnHighlightInTest = true;
    return this._unhighlight(forceUnHighlightInTest);
  }

  getFrames() {
    const frames = this._selectors.getFrames(this._getState());

    // Frames is null when the debugger is not paused.
    if (!frames) {
      return {
        frames: [],
        selected: -1,
      };
    }

    const selectedFrame = this._selectors.getSelectedFrame(this._getState());
    const selected = frames.findIndex(frame => frame.id == selectedFrame.id);

    frames.forEach(frame => {
      frame.actor = frame.id;
    });

    return { frames, selected };
  }

  // Retrieves the debugger's currently selected frame front
  getFrameId() {
    const state = this.getFrames();
    const frame = state?.frames[state?.selected];
    return frame?.protocolId;
  }

  isPaused() {
    return this._selectors.getIsPaused(this._getState());
  }

  selectSourceURL(url, line, column) {
    const cx = this._selectors.getContext(this._getState());
    return this._actions.selectSourceURL(cx, url, { line, column });
  }

  previewPausedLocation(location) {
    return this._actions.previewPausedLocation(location);
  }

  clearPreviewPausedLocation() {
    return this._actions.clearPreviewPausedLocation();
  }

  async selectSource(sourceId, line, column) {
    const cx = this._selectors.getContext(this._getState());
    const location = { sourceId, line, column };

    await this._actions.selectSource(cx, sourceId, location);
  }

  canLoadSource(sourceId) {
    return this._selectors.canLoadSource(this._getState(), sourceId);
  }

  getSourceByActorId(sourceId) {
    return this._selectors.getSourceByActorId(this._getState(), sourceId);
  }

  getSourceByURL(sourceURL) {
    return this._selectors.getSourceByURL(this._getState(), sourceURL);
  }

  destroy() {
    this.panelWin.Debugger.destroy();
    this.emit("destroyed");
  }
}

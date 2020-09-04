/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

import { isConsole } from "../utils/preview";
import { findBestMatchExpression } from "../utils/ast";
import { getExpressionFromCoords } from "../utils/editor/get-expression";
import { isTesting } from "devtools-environment";

import {
  getPreview,
  isLineInScope,
  isSelectedFrameVisible,
  getSelectedSource,
  getSelectedFrame,
  getSymbols,
  getCurrentThread,
  getPreviewCount,
} from "../selectors";

function findExpressionMatch(state, codeMirror, tokenPos) {
  const source = getSelectedSource(state);
  if (!source) {
    return;
  }

  const symbols = getSymbols(state, source);

  let match;
  if (!symbols || symbols.loading) {
    match = getExpressionFromCoords(codeMirror, tokenPos);
  } else {
    match = findBestMatchExpression(symbols, tokenPos);
  }
  return match;
}

export function updatePreview(cx, target, tokenPos, codeMirror) {
  return ({ dispatch, getState, client, sourceMaps }) => {
    const cursorPos = target.getBoundingClientRect();

    if (!isSelectedFrameVisible(getState()) || !isLineInScope(getState(), tokenPos.line)) {
      return;
    }

    const match = findExpressionMatch(getState(), codeMirror, tokenPos);
    if (!match) {
      return;
    }

    const { expression, location } = match;

    if (isConsole(expression)) {
      return;
    }

    dispatch(setPreview(cx, expression, location, tokenPos, cursorPos, target));
  };
}

export function setPreview(cx, expression, location, tokenPos, cursorPos, target) {
  return async ({ dispatch, getState, client, sourceMaps }) => {
    dispatch({ type: "START_PREVIEW" });
    const previewCount = getPreviewCount(getState());
    if (getPreview(getState())) {
      dispatch(clearPreview(cx));
    }

    const source = getSelectedSource(getState());
    if (!source) {
      return;
    }

    const thread = getCurrentThread(getState());
    const selectedFrame = getSelectedFrame(getState(), thread);

    if (!selectedFrame) {
      return;
    }

    const { result } = await client.evaluate(expression, {
      asyncIndex: selectedFrame.asyncIndex,
      frameId: selectedFrame.protocolId,
      thread,
    });

    const root = {
      name: expression,
      path: expression,
      contents: result,
    };
    const properties = await client.loadObjectProperties(root);

    // The first time a popup is rendered, the mouse should be hovered
    // on the token. If it happens to be hovered on whitespace, it should
    // not render anything
    if (!window.elementIsHovered(target)) {
      return;
    }

    // Don't finish dispatching if another setPreview was started
    if (previewCount != getPreviewCount(getState())) {
      return;
    }

    dispatch({
      type: "SET_PREVIEW",
      cx,
      value: {
        expression,
        resultGrip: result,
        properties,
        root,
        location,
        tokenPos,
        cursorPos,
        target,
      },
    });
  };
}

export function clearPreview(cx) {
  return ({ dispatch, getState, client }) => {
    const currentSelection = getPreview(getState());
    if (!currentSelection) {
      return;
    }

    return dispatch({
      type: "CLEAR_PREVIEW",
      cx,
    });
  };
}

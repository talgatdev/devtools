/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

export * from "./source-documents";
export * from "./get-token-location";
export * from "./source-search";
export * from "../ui";
export { onTokenMouseOver } from "./token-events";
export { onGutterMouseOver } from "./gutter-events";

import { createEditor } from "./create-editor";
import { findNext, findPrev } from "./source-search";

let editor;

export function getEditor() {
  if (editor) {
    return editor;
  }

  editor = createEditor();
  return editor;
}

export function removeEditor() {
  editor = null;
}

export function getCodeMirror() {
  return editor?.codeMirror;
}

export function startOperation() {
  const codeMirror = getCodeMirror();
  if (!codeMirror) {
    return;
  }

  codeMirror.startOperation();
}

export function endOperation() {
  const codeMirror = getCodeMirror();
  if (!codeMirror) {
    return;
  }

  codeMirror.endOperation();
}

export function traverseResults(e, ctx, query, dir, modifiers) {
  e.stopPropagation();
  e.preventDefault();

  if (dir == "prev") {
    findPrev(ctx, query, true, modifiers);
  } else if (dir == "next") {
    findNext(ctx, query, true, modifiers);
  }
}

export function toEditorLine(sourceId, lineOrOffset) {
  return lineOrOffset ? lineOrOffset - 1 : 1;
}

export function fromEditorLine(sourceId, line) {
  return line + 1;
}

export function toEditorPosition(location) {
  return {
    line: toEditorLine(location.sourceId, location.line),
    column: !location.column ? 0 : location.column,
  };
}

export function toEditorRange(sourceId, location) {
  const { start, end } = location;
  return {
    start: toEditorPosition({ ...start, sourceId }),
    end: toEditorPosition({ ...end, sourceId }),
  };
}

export function toSourceLine(sourceId, line) {
  return line + 1;
}

export function scrollToColumn(codeMirror, line, column) {
  const { top, left } = codeMirror.charCoords({ line, ch: column }, "local");

  if (!isVisible(codeMirror, top, left)) {
    const scroller = codeMirror.getScrollerElement();
    const centeredX = Math.max(left - scroller.offsetWidth / 2, 0);
    const centeredY = Math.max(top - scroller.offsetHeight / 2, 0);

    codeMirror.scrollTo(centeredX, centeredY);
  }
}

function isVisible(codeMirror, top, left) {
  function withinBounds(x, min, max) {
    return x >= min && x <= max;
  }

  const scrollArea = codeMirror.getScrollInfo();
  const charWidth = codeMirror.defaultCharWidth();
  const fontHeight = codeMirror.defaultTextHeight();
  const { scrollTop, scrollLeft } = codeMirror.doc;

  const inXView = withinBounds(
    left,
    scrollLeft,
    scrollLeft + (scrollArea.clientWidth - 30) - charWidth
  );

  const inYView = withinBounds(top, scrollTop, scrollTop + scrollArea.clientHeight - fontHeight);

  return inXView && inYView;
}

export function getLocationsInViewport(
  { codeMirror },
  // Offset represents an allowance of characters or lines offscreen to improve
  // perceived performance of column breakpoint rendering
  offsetHorizontalCharacters = 100
) {
  // Get scroll position
  if (!codeMirror) {
    return {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    };
  }
  const charWidth = codeMirror.defaultCharWidth();
  const scrollArea = codeMirror.getScrollInfo();
  const { scrollLeft } = codeMirror.doc;

  const leftColumn = Math.floor(
    scrollLeft > 0 ? scrollLeft / charWidth - offsetHorizontalCharacters : 0
  );
  const rightPosition = scrollLeft + (scrollArea.clientWidth - 30);
  const rightCharacter = Math.floor(rightPosition / charWidth) + offsetHorizontalCharacters;

  // This is used to tell codemirror what part of the
  // source file is within the viewport so it knows what
  // breakpoint widgets to render.
  // We're setting start to zero and end to infinity because
  // we want all breakpoint widgets to be rendered on load
  // without removing and re-adding them as they leave the
  // viewport while a user is scrolling through the file
  return {
    start: {
      line: 0,
      column: leftColumn || 0,
    },
    end: {
      line: Number.POSITIVE_INFINITY,
      column: rightCharacter,
    },
  };
}

export function markText({ codeMirror }, className, { start, end }) {
  return codeMirror.markText(
    { ch: start.column, line: start.line },
    { ch: end.column, line: end.line },
    { className }
  );
}

export function lineAtHeight({ codeMirror }, sourceId, event) {
  const _editorLine = codeMirror.lineAtHeight(event.clientY);
  return toSourceLine(sourceId, _editorLine);
}

export function getSourceLocationFromMouseEvent({ codeMirror }, source, e) {
  const { line, ch } = codeMirror.coordsChar({
    left: e.clientX,
    top: e.clientY,
  });
  const sourceId = source.id;

  return {
    sourceId,
    line: fromEditorLine(sourceId, line),
    column: ch + 1,
  };
}

export function forEachLine(codeMirror, iter) {
  codeMirror.operation(() => {
    codeMirror.doc.iter(0, codeMirror.lineCount(), iter);
  });
}

export function removeLineClass(codeMirror, line, className) {
  codeMirror.removeLineClass(line, "line", className);
}

export function clearLineClass(codeMirror, className) {
  forEachLine(codeMirror, line => {
    removeLineClass(codeMirror, line, className);
  });
}

export function getTextForLine(codeMirror, line) {
  return codeMirror.getLine(line - 1).trim();
}

export function getCursorLine(codeMirror) {
  return codeMirror.getCursor().line;
}

export function getCursorColumn(codeMirror) {
  return codeMirror.getCursor().ch;
}

export function getTokenEnd(codeMirror, line, column) {
  const token = codeMirror.getTokenAt({
    line,
    ch: column + 1,
  });
  const tokenString = token.string;

  return tokenString === "{" || tokenString === "[" ? null : token.end;
}

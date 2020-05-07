/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

// @flow
import { sortBy } from "lodash";
import {
  getOriginalFrameScope,
  getGeneratedFrameScope,
  getInlinePreviews,
  getSource,
} from "../../selectors";
import { features } from "../../utils/prefs";
import { validateThreadContext } from "../../utils/context";
import { loadSourceText } from "../sources/loadSourceText";

import type { OriginalScope } from "../../utils/pause/mapScopes";
import type { ThreadContext, Frame, Scope, Preview } from "../../types";
import type { ThunkArgs } from "../types";

// We need to display all variables in the current functional scope so
// include all data for block scopes until the first functional scope
function getLocalScopeLevels(originalAstScopes): number {
  let levels = 0;
  while (
    originalAstScopes[levels] &&
    originalAstScopes[levels].type === "block"
  ) {
    levels++;
  }
  return levels;
}

export function generateInlinePreview(cx: ThreadContext, frameId, location) {
  return async function({ dispatch, getState, parser, client }: ThunkArgs) {
    if (!features.inlinePreview) {
      return;
    }

    const { thread } = cx;

    // Avoid regenerating inline previews when we already have preview data
    if (getInlinePreviews(getState(), thread, frameId)) {
      return;
    }

    ChromeUtils.recordReplayLog(`GenerateInlinePreview Start`);

    const originalFrameScopes = getOriginalFrameScope(
      getState(),
      thread,
      location.sourceId,
      frameId
    );

    const generatedFrameScopes = getGeneratedFrameScope(
      getState(),
      thread,
      frameId
    );

    let scopes: ?OriginalScope | Scope | null =
      (originalFrameScopes && originalFrameScopes.scope) ||
      (generatedFrameScopes && generatedFrameScopes.scope);

    if (!scopes || !scopes.bindings) {
      ChromeUtils.recordReplayLog(`GenerateInlinePreview LoadSourceText NoFrameScopes`);
      return;
    }

    ChromeUtils.recordReplayLog(`GenerateInlinePreview LoadSourceText Start`);

    const source = getSource(getState(), location.sourceId);
    if (!source) {
      return;
    }
    await dispatch(loadSourceText({ cx, source }));

    ChromeUtils.recordReplayLog(`GenerateInlinePreview LoadSourceText Done`);

    let originalAstScopes = client.eventMethods.maybeScopes(location);
    if (!originalAstScopes) {
      ChromeUtils.recordReplayLog(`GenerateInlinePreview FetchingScopes`);
      originalAstScopes = await parser.getScopes(location);
      client.eventMethods.addScopes(location, originalAstScopes);
      validateThreadContext(getState(), cx);
      if (!originalAstScopes) {
        ChromeUtils.recordReplayLog(`GenerateInlinePreview NoScopes`);
        return;
      }
    }

    ChromeUtils.recordReplayLog(`GenerateInlinePreview ScopesLoaded`);

    const allPreviews = [];
    const pausedOnLine: number = location.line;
    const levels: number = getLocalScopeLevels(originalAstScopes);

    for (
      let curLevel = 0;
      curLevel <= levels && scopes && scopes.bindings;
      curLevel++
    ) {
      const bindings = { ...scopes.bindings.variables };
      scopes.bindings.arguments.forEach(argument => {
        Object.keys(argument).forEach(key => {
          bindings[key] = argument[key];
        });
      });

      const previewBindings = Object.keys(bindings).map(async name => {
        // We want to show values of properties of objects only and not
        // function calls on other data types like someArr.forEach etc..
        let properties = null;
        const objectFront = bindings[name].value;
        if (objectFront.actorID && objectFront.class === "Object") {
          properties = await client.loadObjectProperties({
            name,
            path: name,
            contents: { value: objectFront },
          });
        }

        const previewsFromBindings: Array<Preview> = getBindingValues(
          originalAstScopes,
          pausedOnLine,
          name,
          bindings[name].value,
          curLevel,
          properties
        );

        allPreviews.push(...previewsFromBindings);
      });

      ChromeUtils.recordReplayLog(`GenerateInlinePreview PreviewBindings ${curLevel} Start`);

      await Promise.all(previewBindings);

      ChromeUtils.recordReplayLog(`GenerateInlinePreview PreviewBindings ${curLevel} Done`);

      scopes = scopes.parent;
    }

    const previews = {};
    const sortedPreviews = sortBy(allPreviews, ["line", "column"]);

    sortedPreviews.forEach(preview => {
      const { line } = preview;
      if (!previews[line]) {
        previews[line] = [preview];
      } else {
        previews[line].push(preview);
      }
    });

    return dispatch({
      type: "ADD_INLINE_PREVIEW",
      thread,
      frameId,
      previews,
    });
  };
}

function getBindingValues(
  originalAstScopes: Object,
  pausedOnLine: number,
  name: string,
  value: any,
  curLevel: number,
  properties: Array<Object> | null
): Array<Preview> {
  const previews = [];

  const binding =
    originalAstScopes[curLevel] && originalAstScopes[curLevel].bindings[name];
  if (!binding) {
    return previews;
  }

  // Show a variable only once ( an object and it's child property are
  // counted as different )
  const identifiers = new Set();

  // We start from end as we want to show values besides variable
  // located nearest to the breakpoint
  for (let i = binding.refs.length - 1; i >= 0; i--) {
    const ref = binding.refs[i];
    // Subtracting 1 from line as codemirror lines are 0 indexed
    const line = ref.start.line - 1;
    const column: number = ref.start.column;
    // We don't want to render inline preview below the paused line
    if (line >= pausedOnLine - 1) {
      continue;
    }

    const { displayName, displayValue } = getExpressionNameAndValue(
      name,
      value,
      ref,
      properties
    );

    // Variable with same name exists, display value of current or
    // closest to the current scope's variable
    if (identifiers.has(displayName)) {
      continue;
    }
    identifiers.add(displayName);

    previews.push({
      line,
      column,
      name: displayName,
      value: displayValue,
    });
  }
  return previews;
}

function getExpressionNameAndValue(
  name: string,
  value: any,
  // TODO: Add data type to ref
  ref: Object,
  properties: Array<Object> | null
) {
  let displayName = name;
  let displayValue = value;

  // Only variables of type Object will have properties
  if (properties) {
    let { meta } = ref;
    // Presence of meta property means expression contains child property
    // reference eg: objName.propName
    while (meta) {
      // Initially properties will be an array, after that it will be an object
      if (displayValue === value) {
        const property: Object = properties.find(
          prop => prop.name === meta.property
        );
        displayValue = property && property.contents.value;
        displayName += `.${meta.property}`;
      } else if (
        displayValue &&
        displayValue.preview &&
        displayValue.preview.ownProperties
      ) {
        const { ownProperties } = displayValue.preview;
        Object.keys(ownProperties).forEach(prop => {
          if (prop === meta.property) {
            displayValue = ownProperties[prop].value;
            displayName += `.${meta.property}`;
          }
        });
      }
      meta = meta.parent;
    }
  }

  return { displayName, displayValue };
}

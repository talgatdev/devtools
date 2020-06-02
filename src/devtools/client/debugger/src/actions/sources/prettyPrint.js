/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

import assert from "../../utils/assert";
import { recordEvent } from "../../utils/telemetry";
import { remapBreakpoints } from "../breakpoints";

import { setSymbols } from "./symbols";
import { prettyPrint } from "../../workers/pretty-print";
import {
  getPrettySourceURL,
  isGenerated,
  isJavaScript,
} from "../../utils/source";
import { loadSourceText } from "./loadSourceText";
import { selectSpecificLocation } from "../sources";

import {
  getSource,
  getSourceFromId,
  getSourceByURL,
  getSelectedLocation,
  getThreadContext,
} from "../../selectors";

import type { Action, ThunkArgs } from "../types";
import { selectSource } from "./select";
import type {
  Source,
  SourceContent,
  SourceActor,
  Context,
  SourceLocation,
} from "../../types";

export async function prettyPrintSource(
  client,
  generatedSource: Source,
  content: SourceContent,
  actors: Array<SourceActor>
) {
  throw new Error("NYI");
}

function toNavigateContext(cx) {
  return { navigateCounter: cx.navigateCounter };
}

export function createPrettySource(cx: Context, sourceId: string) {
  return async ({ dispatch, getState, sourceMaps }: ThunkArgs) => {
    throw new Error("NYI");
    /*
    cx = toNavigateContext(cx);

    const source = getSourceFromId(getState(), sourceId);
    const url = getPrettySourceURL(source.url || source.id);
    const id = generatedToOriginalId(sourceId, url);

    const prettySource = {
      id,
      url,
      relativeUrl: url,
      isBlackBoxed: false,
      isPrettyPrinted: true,
      isWasm: false,
      introductionUrl: null,
      introductionType: undefined,
      isExtension: false,
      extensionName: null,
      isOriginal: true,
    };

    dispatch(({ type: "ADD_SOURCE", cx, source: prettySource }: Action));

    await dispatch(selectSource(cx, id));

    return prettySource;
    */
  };
}

function selectPrettyLocation(
  cx: Context,
  prettySource: Source,
  generatedLocation: ?SourceLocation
) {
  return async ({ dispatch, getState }: ThunkArgs) => {
    throw new Error("NYI");
    /*
    let location = generatedLocation
      ? generatedLocation
      : getSelectedLocation(getState());

    if (location && location.line >= 1) {
      location = await sourceMaps.getOriginalLocation(location);

      return dispatch(
        selectSpecificLocation(cx, { ...location, sourceId: prettySource.id })
      );
    }

    return dispatch(selectSource(cx, prettySource.id));
    */
  };
}

/**
 * Toggle the pretty printing of a source's text. All subsequent calls to
 * |getText| will return the pretty-toggled text. Nothing will happen for
 * non-javascript files.
 *
 * @memberof actions/sources
 * @static
 * @param string id The source form from the RDP.
 * @returns Promise
 *          A promise that resolves to [aSource, prettyText] or rejects to
 *          [aSource, error].
 */
export function togglePrettyPrint(cx: Context, sourceId: string) {
  return async ({ dispatch, getState, client, sourceMaps }: ThunkArgs) => {
    throw new Error("NYI");
    /*
    const source = getSource(getState(), sourceId);
    if (!source) {
      return {};
    }

    if (!source.isPrettyPrinted) {
      recordEvent("pretty_print");
    }

    await dispatch(loadSourceText({ cx, source }));
    assert(
      isGenerated(source),
      "Pretty-printing only allowed on generated sources"
    );

    const url = getPrettySourceURL(source.url);
    const prettySource = getSourceByURL(getState(), url);

    if (prettySource) {
      return dispatch(selectPrettyLocation(cx, prettySource));
    }

    const selectedLocation = getSelectedLocation(getState());
    const newPrettySource = await dispatch(createPrettySource(cx, sourceId));
    dispatch(selectPrettyLocation(cx, newPrettySource, selectedLocation));

    const threadcx = getThreadContext(getState());
    await dispatch(mapFrames(threadcx));

    await dispatch(setSymbols({ cx, source: newPrettySource }));

    await dispatch(remapBreakpoints(cx, sourceId));

    return newPrettySource;
    */
  };
}

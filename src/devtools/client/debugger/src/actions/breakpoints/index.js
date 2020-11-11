/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

/**
 * Redux actions for breakpoints
 * @module actions/breakpoints
 */

import { PROMISE } from "../utils/middleware/promise";
import {
  getBreakpointsList,
  getSelectedSource,
  getBreakpointAtLocation,
  getBreakpointsForSource,
  getBreakpointsAtLine,
} from "../../selectors";
import { addBreakpoint, removeBreakpoint, enableBreakpoint, disableBreakpoint } from "./modify";
import remapLocations from "./remapLocations";

// this will need to be changed so that addCLientBreakpoint is removed

export * from "./breakpointPositions";
export * from "./modify";
export * from "./syncBreakpoint";

/**
 * Disable all breakpoints in a source
 *
 * @memberof actions/breakpoints
 * @static
 */
export function disableBreakpointsInSource(cx, source) {
  return async ({ dispatch, getState, client }) => {
    const breakpoints = getBreakpointsForSource(getState(), source.id);
    for (const breakpoint of breakpoints) {
      if (!breakpoint.disabled) {
        dispatch(disableBreakpoint(cx, breakpoint));
      }
    }
  };
}

/**
 * Enable all breakpoints in a source
 *
 * @memberof actions/breakpoints
 * @static
 */
export function enableBreakpointsInSource(cx, source) {
  return async ({ dispatch, getState, client }) => {
    const breakpoints = getBreakpointsForSource(getState(), source.id);
    for (const breakpoint of breakpoints) {
      if (breakpoint.disabled) {
        dispatch(enableBreakpoint(cx, breakpoint));
      }
    }
  };
}

/**
 * Toggle All Breakpoints
 *
 * @memberof actions/breakpoints
 * @static
 */
export function toggleAllBreakpoints(cx, shouldDisableBreakpoints) {
  return async ({ dispatch, getState, client }) => {
    const breakpoints = getBreakpointsList(getState());

    for (const breakpoint of breakpoints) {
      if (shouldDisableBreakpoints) {
        dispatch(disableBreakpoint(cx, breakpoint));
      } else {
        dispatch(enableBreakpoint(cx, breakpoint));
      }
    }
  };
}

/**
 * Toggle Breakpoints
 *
 * @memberof actions/breakpoints
 * @static
 */
export function toggleBreakpoints(cx, shouldDisableBreakpoints, breakpoints) {
  return async ({ dispatch }) => {
    const promises = breakpoints.map(breakpoint =>
      shouldDisableBreakpoints
        ? dispatch(disableBreakpoint(cx, breakpoint))
        : dispatch(enableBreakpoint(cx, breakpoint))
    );

    await Promise.all(promises);
  };
}

export function toggleBreakpointsAtLine(cx, shouldDisableBreakpoints, line) {
  return async ({ dispatch, getState }) => {
    const breakpoints = getBreakpointsAtLine(getState(), line);
    return dispatch(toggleBreakpoints(cx, shouldDisableBreakpoints, breakpoints));
  };
}

/**
 * Removes all breakpoints
 *
 * @memberof actions/breakpoints
 * @static
 */
export function removeAllBreakpoints(cx) {
  return async ({ dispatch, getState }) => {
    const breakpointList = getBreakpointsList(getState());
    await Promise.all(breakpointList.map(bp => dispatch(removeBreakpoint(cx, bp))));
    dispatch({ type: "REMOVE_BREAKPOINTS" });
  };
}

/**
 * Removes breakpoints
 *
 * @memberof actions/breakpoints
 * @static
 */
export function removeBreakpoints(cx, breakpoints) {
  return async ({ dispatch }) => {
    return Promise.all(breakpoints.map(bp => dispatch(removeBreakpoint(cx, bp))));
  };
}

/**
 * Removes all breakpoints in a source
 *
 * @memberof actions/breakpoints
 * @static
 */
export function removeBreakpointsInSource(cx, source) {
  return async ({ dispatch, getState, client }) => {
    const breakpoints = getBreakpointsForSource(getState(), source.id);
    for (const breakpoint of breakpoints) {
      dispatch(removeBreakpoint(cx, breakpoint));
    }
  };
}

export function remapBreakpoints(cx, sourceId) {
  return async ({ dispatch, getState, sourceMaps }) => {
    const breakpoints = getBreakpointsForSource(getState(), sourceId);
    const newBreakpoints = await remapLocations(breakpoints, sourceId, sourceMaps);

    // Normally old breakpoints will be clobbered if we re-add them, but when
    // remapping we have changed the source maps and the old breakpoints will
    // have different locations than the new ones. Manually remove the
    // old breakpoints before adding the new ones.
    for (const bp of breakpoints) {
      dispatch(removeBreakpoint(cx, bp));
    }

    for (const bp of newBreakpoints) {
      await dispatch(addBreakpoint(cx, bp.location, bp.options, bp.disabled));
    }
  };
}

export function toggleBreakpointAtLine(cx, line) {
  return ({ dispatch, getState, client, sourceMaps }) => {
    const state = getState();
    const selectedSource = getSelectedSource(state);

    if (!selectedSource) {
      return;
    }

    const bp = getBreakpointAtLocation(state, { line, column: undefined });
    if (bp) {
      return dispatch(removeBreakpoint(cx, bp));
    }
    return dispatch(
      addBreakpoint(cx, {
        sourceId: selectedSource.id,
        sourceUrl: selectedSource.url,
        line,
      })
    );
  };
}

export function addBreakpointAtLine(cx, line, shouldLog = false, disabled = false) {
  return ({ dispatch, getState, client, sourceMaps }) => {
    const state = getState();
    const source = getSelectedSource(state);

    if (!source) {
      return;
    }
    const breakpointLocation = {
      sourceId: source.id,
      sourceUrl: source.url,
      column: undefined,
      line,
    };

    const options = {};
    const file = source.url.split("/").pop();
    options.logValue = `"${file}:${line}"`;

    return dispatch(addBreakpoint(cx, breakpointLocation, options, disabled));
  };
}

export function addBreakpointAtColumn(cx, location) {
  return ({ dispatch, getState }) => {
    const state = getState();
    const source = getSelectedSource(state);
    const { column, line } = location;

    if (!source) {
      return;
    }
    const breakpointLocation = {
      sourceId: source.id,
      sourceUrl: source.url,
      column: column,
      line: line,
    };

    const options = {};
    const file = source.url.split("/").pop();
    options.logValue = `"${file}:${line}:${column}"`;

    return dispatch(addBreakpoint(cx, breakpointLocation, options));
  };
}

export function removeBreakpointsAtLine(cx, sourceId, line) {
  return ({ dispatch, getState, client, sourceMaps }) => {
    const breakpointsAtLine = getBreakpointsForSource(getState(), sourceId, line);
    return dispatch(removeBreakpoints(cx, breakpointsAtLine));
  };
}

export function disableBreakpointsAtLine(cx, sourceId, line) {
  return ({ dispatch, getState, client, sourceMaps }) => {
    const breakpointsAtLine = getBreakpointsForSource(getState(), sourceId, line);
    return dispatch(toggleBreakpoints(cx, true, breakpointsAtLine));
  };
}

export function enableBreakpointsAtLine(cx, sourceId, line) {
  return ({ dispatch, getState, client, sourceMaps }) => {
    const breakpointsAtLine = getBreakpointsForSource(getState(), sourceId, line);
    return dispatch(toggleBreakpoints(cx, false, breakpointsAtLine));
  };
}

export function toggleDisabledBreakpoint(cx, breakpoint) {
  return ({ dispatch, getState, client, sourceMaps }) => {
    if (!breakpoint.disabled) {
      return dispatch(disableBreakpoint(cx, breakpoint));
    }
    return dispatch(enableBreakpoint(cx, breakpoint));
  };
}

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */
// @flow

import { groupBy } from "lodash";
import { createSelector } from "reselect";

import {
  getViewport,
  getSource,
  getSelectedSource,
  getSelectedSourceWithContent,
  getBreakpointPositions,
  getBreakpointPositionsForSource,
} from "../selectors";
import { getVisibleBreakpoints } from "./visibleBreakpoints";
import { sortSelectedLocations } from "../utils/location";
import { getLineText } from "../utils/source";

import type { Selector, State } from "../reducers/types";

import type {
  SourceLocation,
  PartialPosition,
  Breakpoint,
  Range,
  BreakpointPositions,
  BreakpointPosition,
  SourceWithContent,
} from "../types";

export type ColumnBreakpoint = {|
  +location: SourceLocation,
  +breakpoint: ?Breakpoint,
|};

export type ColumnBreakpoints = Array<ColumnBreakpoint>;

function contains(location: PartialPosition, range: Range) {
  return (
    location.line >= range.start.line &&
    location.line <= range.end.line &&
    (!location.column ||
      (location.column >= range.start.column &&
        location.column <= range.end.column))
  );
}

function groupBreakpoints(breakpoints, selectedSource) {
  if (!breakpoints) {
    return {};
  }

  const map: any = groupBy(
    breakpoints.filter(breakpoint => !breakpoint.options.hidden),
    breakpoint => breakpoint.location.line
  );

  for (const line in map) {
    map[line] = groupBy(
      map[line],
      breakpoint => breakpoint.location.column
    );
  }

  return map;
}

function findBreakpoint(location, breakpointMap) {
  const { line, column } = location;
  const breakpoints = breakpointMap[line] && breakpointMap[line][column];

  if (breakpoints) {
    return breakpoints[0];
  }
}

function filterByLineCount(positions, selectedSource) {
  const lineCount = {};

  for (const breakpoint of positions) {
    const { line } = breakpoint.location;
    if (!lineCount[line]) {
      lineCount[line] = 0;
    }

    lineCount[line] = lineCount[line] + 1;
  }

  return positions.filter(
    breakpoint => lineCount[breakpoint.location.line] > 1
  );
}

function filterVisible(positions, selectedSource, viewport) {
  return positions.filter(columnBreakpoint => {
    const location = columnBreakpoint.location;

    return viewport && contains(location, viewport);
  });
}

function filterByBreakpoints(positions, selectedSource, breakpointMap) {
  return positions.filter(position => {
    return breakpointMap[position.location.line];
  });
}

// Filters out breakpoints to the right of the line. (bug 1552039)
function filterInLine(positions, selectedSource, selectedContent) {
  return positions.filter(position => {
    const location = position.location;
    const lineText = getLineText(
      selectedSource.id,
      selectedContent,
      location.line
    );

    return lineText.length >= (location.column || 0);
  });
}

function formatPositions(
  positions: BreakpointPosition[],
  selectedSource,
  breakpointMap
) {
  return (positions: any).map((position: BreakpointPosition) => {
    const location = position.location;
    return {
      location,
      breakpoint: findBreakpoint(location, breakpointMap),
    };
  });
}

function convertToList(
  breakpointPositions: BreakpointPositions
): BreakpointPosition[] {
  return ([].concat(...Object.values(breakpointPositions)): any);
}

export function getColumnBreakpoints(
  positions: BreakpointPosition[],
  breakpoints: ?(Breakpoint[]),
  viewport: ?Range,
  selectedSource: ?SourceWithContent
) {
  if (!positions || !selectedSource) {
    return [];
  }

  // We only want to show a column breakpoint if several conditions are matched
  // - it is the first breakpoint to appear at an the original location
  // - the position is in the current viewport
  // - there is atleast one other breakpoint on that line
  // - there is a breakpoint on that line
  const breakpointMap = groupBreakpoints(breakpoints, selectedSource);
  positions = filterByLineCount(positions, selectedSource);
  positions = filterVisible(positions, selectedSource, viewport);
  positions = filterInLine(positions, selectedSource, selectedSource.content);
  positions = filterByBreakpoints(positions, selectedSource, breakpointMap);

  return formatPositions(positions, selectedSource, breakpointMap);
}

const getVisibleBreakpointPositions = createSelector(
  getSelectedSource,
  getBreakpointPositions,
  (source, positions) => {
    if (!source) {
      return [];
    }

    const sourcePositions = positions[source.id];
    if (!sourcePositions) {
      return [];
    }

    return convertToList(sourcePositions);
  }
);

export const visibleColumnBreakpoints: Selector<ColumnBreakpoints> = createSelector(
  getVisibleBreakpointPositions,
  getVisibleBreakpoints,
  getViewport,
  getSelectedSourceWithContent,
  getColumnBreakpoints
);

export function getFirstBreakpointPosition(
  state: State,
  { line, sourceId }: SourceLocation
): ?BreakpointPosition {
  const positions = getBreakpointPositionsForSource(state, sourceId);
  const source = getSource(state, sourceId);

  if (!source || !positions) {
    return;
  }

  return sortSelectedLocations(convertToList(positions), source).find(
    position => position.location.line == line
  );
}

import { UIThunkAction } from "ui/actions";
import { PendingBreakpoint } from "../../reducers/types";

export interface Context {
  isPaused: boolean;
  navigateCounter: number;
  pauseCounter: number;
}

export function runAnalysisOnLine(cx: Context, line: number): UIThunkAction;
export function updateHoveredLineNumber(line: number): UIThunkAction;
export function _addBreakpointAtLine(
  cx: Context,
  line: number,
  shouldLog: boolean,
  disabled: boolean,
  breakable: boolean
): UIThunkAction;
export function syncBreakpoint(
  cx: Context,
  sourceId: string,
  pendingBreakpoint: Breakpoint
): UIThunkAction;

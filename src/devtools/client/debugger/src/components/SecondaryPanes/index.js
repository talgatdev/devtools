/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

// @flow

import React, { Component } from "react";
import classnames from "classnames";
import { connect } from "../../utils/connect";
import { List } from "immutable";

import actions from "../../actions";
import {
  getTopFrame,
  getBreakpointsList,
  getBreakpointsDisabled,
  getExpressions,
  getIsWaitingOnBreak,
  getPauseCommand,
  getSelectedFrame,
  getShouldLogExceptions,
  getThreads,
  getCurrentThread,
  getThreadContext,
  getSourceFromId,
  getSkipPausing,
  shouldLogEventBreakpoints,
  getFramesLoading,
} from "../../selectors";

import AccessibleImage from "../shared/AccessibleImage";
import { prefs, features } from "../../utils/prefs";

import Breakpoints from "./Breakpoints";
import Expressions from "./Expressions";
import SplitBox from "devtools-splitter";
import Frames from "./Frames";
import Threads from "./Threads";
import Accordion from "../shared/Accordion";
import CommandBar from "./CommandBar";
import XHRBreakpoints from "./XHRBreakpoints";
import EventListeners from "./EventListeners";
import DOMMutationBreakpoints from "./DOMMutationBreakpoints";
import WhyPaused from "./WhyPaused";
import FrameTimeline from "./FrameTimeline";

import Scopes from "./Scopes";

import "./SecondaryPanes.css";

import type { Expression, Frame, ThreadList, ThreadContext, Source } from "../../types";

type AccordionPaneItem = {
  header: string,
  component: any,
  opened?: boolean,
  onToggle?: () => void,
  shouldOpen?: () => boolean,
  buttons?: any,
};

function debugBtn(onClick, type, className, tooltip) {
  return (
    <button onClick={onClick} className={`${type} ${className}`} key={type} title={tooltip}>
      <AccessibleImage className={type} title={tooltip} aria-label={tooltip} />
    </button>
  );
}

type State = {
  showExpressionsInput: boolean,
  showXHRInput: boolean,
};

type OwnProps = {|
  horizontal: boolean,
|};
type Props = {
  cx: ThreadContext,
  expressions: List<Expression>,
  hasFrames: boolean,
  framesLoading: boolean,
  horizontal: boolean,
  breakpoints: Object,
  selectedFrame: ?Frame,
  breakpointsDisabled: boolean,
  isWaitingOnBreak: boolean,
  renderWhyPauseDelay: number,
  shouldLogExceptions: boolean,
  workers: ThreadList,
  skipPausing: boolean,
  logEventBreakpoints: boolean,
  source: ?Source,
  toggleAllBreakpoints: typeof actions.toggleAllBreakpoints,
  evaluateExpressions: typeof actions.evaluateExpressions,
  logExceptions: typeof actions.logExceptions,
  breakOnNext: typeof actions.breakOnNext,
  toggleEventLogging: typeof actions.toggleEventLogging,
};

const mdnLink =
  "https://developer.mozilla.org/docs/Tools/Debugger/Using_the_Debugger_map_scopes_feature?utm_source=devtools&utm_medium=debugger-map-scopes";

class SecondaryPanes extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      showExpressionsInput: false,
      showXHRInput: false,
    };
  }

  onExpressionAdded = () => {
    this.setState({ showExpressionsInput: false });
  };

  onXHRAdded = () => {
    this.setState({ showXHRInput: false });
  };

  renderBreakpointsToggle() {
    const { cx, toggleAllBreakpoints, breakpoints, breakpointsDisabled } = this.props;
    const isIndeterminate = !breakpointsDisabled && breakpoints.some(x => x.disabled);

    if (features.skipPausing || breakpoints.length === 0) {
      return null;
    }

    const inputProps = {
      type: "checkbox",
      "aria-label": breakpointsDisabled
        ? L10N.getStr("breakpoints.enable")
        : L10N.getStr("breakpoints.disable"),
      className: "breakpoints-toggle",
      disabled: false,
      key: "breakpoints-toggle",
      onChange: e => {
        e.stopPropagation();
        toggleAllBreakpoints(cx, !breakpointsDisabled);
      },
      onClick: e => e.stopPropagation(),
      checked: !breakpointsDisabled && !isIndeterminate,
      ref: input => {
        if (input) {
          input.indeterminate = isIndeterminate;
        }
      },
      title: breakpointsDisabled
        ? L10N.getStr("breakpoints.enable")
        : L10N.getStr("breakpoints.disable"),
    };

    return <input {...inputProps} />;
  }

  watchExpressionHeaderButtons() {
    const { expressions } = this.props;

    const buttons = [];

    if (expressions.length) {
      buttons.push(
        debugBtn(
          evt => {
            evt.stopPropagation();
            this.props.evaluateExpressions(this.props.cx);
          },
          "refresh",
          "refresh",
          L10N.getStr("watchExpressions.refreshButton")
        )
      );
    }

    buttons.push(
      debugBtn(
        evt => {
          if (prefs.expressionsVisible) {
            evt.stopPropagation();
          }
          this.setState({ showExpressionsInput: true });
        },
        "plus",
        "plus",
        L10N.getStr("expressions.placeholder")
      )
    );

    return buttons;
  }

  xhrBreakpointsHeaderButtons() {
    const buttons = [];

    buttons.push(
      debugBtn(
        evt => {
          if (prefs.xhrBreakpointsVisible) {
            evt.stopPropagation();
          }
          this.setState({ showXHRInput: true });
        },
        "plus",
        "plus",
        L10N.getStr("xhrBreakpoints.label")
      )
    );

    return buttons;
  }

  getScopeItem(): AccordionPaneItem {
    return {
      header: L10N.getStr("scopes.header"),
      className: "scopes-pane",
      component: <Scopes />,
      opened: prefs.scopesVisible,
      onToggle: opened => {
        prefs.scopesVisible = opened;
      },
    };
  }

  getWatchItem(): AccordionPaneItem {
    return {
      header: L10N.getStr("watchExpressions.header"),
      className: "watch-expressions-pane",
      buttons: this.watchExpressionHeaderButtons(),
      component: (
        <Expressions
          showInput={this.state.showExpressionsInput}
          onExpressionAdded={this.onExpressionAdded}
        />
      ),
      opened: prefs.expressionsVisible,
      onToggle: opened => {
        prefs.expressionsVisible = opened;
      },
    };
  }

  getXHRItem(): AccordionPaneItem {
    return {
      header: L10N.getStr("xhrBreakpoints.header"),
      className: "xhr-breakpoints-pane",
      buttons: this.xhrBreakpointsHeaderButtons(),
      component: (
        <XHRBreakpoints showInput={this.state.showXHRInput} onXHRAdded={this.onXHRAdded} />
      ),
      opened: prefs.xhrBreakpointsVisible,
      onToggle: opened => {
        prefs.xhrBreakpointsVisible = opened;
      },
    };
  }

  getCallStackItem(): AccordionPaneItem {
    return {
      header: L10N.getStr("callStack.header"),
      className: "call-stack-pane",
      component: <Frames panel="debugger" />,
      opened: prefs.callStackVisible,
      onToggle: opened => {
        prefs.callStackVisible = opened;
      },
    };
  }

  getThreadsItem(): AccordionPaneItem {
    return {
      header: L10N.getStr("threadsHeader"),
      className: "threads-pane",
      component: <Threads />,
      opened: prefs.workersVisible,
      onToggle: opened => {
        prefs.workersVisible = opened;
      },
    };
  }

  getBreakpointsItem(): AccordionPaneItem {
    const { shouldLogExceptions, logExceptions } = this.props;

    return {
      header: L10N.getStr("breakpoints.header"),
      className: "breakpoints-pane",
      buttons: [this.renderBreakpointsToggle()],
      component: (
        <Breakpoints shouldLogExceptions={shouldLogExceptions} logExceptions={logExceptions} />
      ),
      opened: prefs.breakpointsVisible,
      onToggle: opened => {
        prefs.breakpointsVisible = opened;
      },
    };
  }

  getEventListenersItem(): AccordionPaneItem {
    return {
      header: L10N.getStr("eventListenersHeader1"),
      className: "event-listeners-pane",
      component: <EventListeners />,
      opened: prefs.eventListenersVisible,
      onToggle: opened => {
        prefs.eventListenersVisible = opened;
      },
    };
  }

  getDOMMutationsItem(): AccordionPaneItem {
    return {
      header: L10N.getStr("domMutationHeader"),
      className: "dom-mutations-pane",
      buttons: [],
      component: <DOMMutationBreakpoints />,
      opened: prefs.domMutationBreakpointsVisible,
      onToggle: opened => {
        prefs.domMutationBreakpointsVisible = opened;
      },
    };
  }

  getStartItems(): AccordionPaneItem[] {
    const items: AccordionPaneItem[] = [];
    const { horizontal, hasFrames, framesLoading } = this.props;

    if (horizontal) {
      if (features.workers && this.props.workers.length > 0) {
        items.push(this.getThreadsItem());
      }

      items.push(this.getWatchItem());
    }

    items.push(this.getBreakpointsItem());

    if (hasFrames) {
      items.push(this.getCallStackItem());
      if (horizontal) {
        items.push(this.getScopeItem());
      }
    } else if (framesLoading) {
      items.push(this.getCallStackItem());
    }

    /*
    if (features.xhrBreakpoints) {
      items.push(this.getXHRItem());
    }
    */

    if (features.eventListenersBreakpoints) {
      items.push(this.getEventListenersItem());
    }

    /*
    if (features.domMutationBreakpoints) {
      items.push(this.getDOMMutationsItem());
    }
    */

    return items;
  }

  getEndItems(): AccordionPaneItem[] {
    if (this.props.horizontal) {
      return [];
    }

    const items: AccordionPaneItem[] = [];
    if (features.workers && this.props.workers.length > 0) {
      items.push(this.getThreadsItem());
    }

    items.push(this.getWatchItem());

    if (this.props.hasFrames) {
      items.push(this.getScopeItem());
    }

    return items;
  }

  getItems(): AccordionPaneItem[] {
    return [...this.getStartItems(), ...this.getEndItems()];
  }

  renderHorizontalLayout() {
    const { renderWhyPauseDelay } = this.props;

    return (
      <div>
        <WhyPaused delay={renderWhyPauseDelay} />
        <Accordion items={this.getItems()} />
      </div>
    );
  }

  renderVerticalLayout() {
    return (
      <SplitBox
        initialSize="300px"
        minSize={10}
        maxSize="50%"
        splitterSize={1}
        startPanel={
          <div style={{ width: "inherit" }}>
            <WhyPaused delay={this.props.renderWhyPauseDelay} />
            <Accordion items={this.getStartItems()} />
          </div>
        }
        endPanel={<Accordion items={this.getEndItems()} />}
      />
    );
  }

  render() {
    const { skipPausing } = this.props;
    return (
      <div className="secondary-panes-wrapper">
        <CommandBar horizontal={this.props.horizontal} />
        <FrameTimeline />
        <div className={classnames("secondary-panes", skipPausing && "skip-pausing")}>
          {this.props.horizontal ? this.renderHorizontalLayout() : this.renderVerticalLayout()}
        </div>
      </div>
    );
  }
}

// Checks if user is in debugging mode and adds a delay preventing
// excessive vertical 'jumpiness'
function getRenderWhyPauseDelay(state, thread) {
  const inPauseCommand = !!getPauseCommand(state, thread);

  if (!inPauseCommand) {
    return 100;
  }

  return 0;
}

const mapStateToProps = state => {
  const thread = getCurrentThread(state);
  const selectedFrame = getSelectedFrame(state, thread);

  return {
    cx: getThreadContext(state),
    expressions: getExpressions(state),
    hasFrames: !!getTopFrame(state, thread),
    framesLoading: getFramesLoading(state, thread),
    breakpoints: getBreakpointsList(state),
    breakpointsDisabled: getBreakpointsDisabled(state),
    isWaitingOnBreak: getIsWaitingOnBreak(state, thread),
    renderWhyPauseDelay: getRenderWhyPauseDelay(state, thread),
    selectedFrame,
    shouldLogExceptions: getShouldLogExceptions(state),
    workers: getThreads(state),
    skipPausing: getSkipPausing(state),
    logEventBreakpoints: shouldLogEventBreakpoints(state),
    source: selectedFrame && getSourceFromId(state, selectedFrame.location.sourceId),
  };
};

export default connect<Props, OwnProps, _, _, _, _>(mapStateToProps, {
  toggleAllBreakpoints: actions.toggleAllBreakpoints,
  evaluateExpressions: actions.evaluateExpressions,
  logExceptions: actions.logExceptions,
  breakOnNext: actions.breakOnNext,
  toggleEventLogging: actions.toggleEventLogging,
})(SecondaryPanes);

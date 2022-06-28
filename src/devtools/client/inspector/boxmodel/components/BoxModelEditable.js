/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Services = require("devtools/shared/services");
const { PureComponent } = require("react");
const dom = require("react-dom-factories");
const PropTypes = require("prop-types");
const { editableItem } = require("devtools/client/shared/inplace-editor");

const LONG_TEXT_ROTATE_LIMIT = 3;
const HIGHLIGHT_RULE_PREF = Services.prefs.getBoolPref(
  "devtools.layout.boxmodel.highlightProperty"
);

class BoxModelEditable extends PureComponent {
  static get propTypes() {
    return {
      box: PropTypes.string.isRequired,
      direction: PropTypes.string,
      focusable: PropTypes.bool.isRequired,
      level: PropTypes.string,
      onShowBoxModelEditor: PropTypes.func.isRequired,
      onShowRulePreviewTooltip: PropTypes.func.isRequired,
      property: PropTypes.string.isRequired,
      textContent: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    };
  }

  constructor(props) {
    super(props);
    this.onMouseOver = this.onMouseOver.bind(this);
  }

  componentDidMount() {
    const { property, onShowBoxModelEditor } = this.props;

    /*
    editableItem(
      {
        element: this.boxModelEditable,
      },
      (element, event) => {
        onShowBoxModelEditor(element, event, property);
      }
    );
    */
  }

  onMouseOver(event) {
    // TODO Can probably clear out much of this component
  }

  render() {
    const { box, direction, focusable, level, property, textContent } = this.props;

    const rotate =
      direction &&
      (direction == "left" || direction == "right") &&
      box !== "position" &&
      textContent.toString().length > LONG_TEXT_ROTATE_LIMIT;

    return dom.p(
      {
        className: `boxmodel-${box}
                      ${direction ? " boxmodel-" + direction : "boxmodel-" + property}
                      ${rotate ? " boxmodel-rotate" : ""}`,
      },
      dom.span(
        {
          className: "boxmodel-editable",
          "data-box": box,
          tabIndex: box === level && focusable ? 0 : -1,
          title: property,
          onMouseOver: this.onMouseOver,
          ref: span => {
            this.boxModelEditable = span;
          },
        },
        textContent
      )
    );
  }
}

module.exports = BoxModelEditable;

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

import { getSelectedFrame, getFrameScope } from "../../selectors";
import { generateInlinePreview } from "./inlinePreview";
import { PROMISE } from "../utils/middleware/promise";

export function fetchScopes(cx) {
  return async function ({ dispatch, getState, client, sourceMaps }) {
    const frame = getSelectedFrame(getState(), cx.thread);
    if (!frame || getFrameScope(getState(), cx.thread, frame.id)) {
      return;
    }

    const scopes = dispatch({
      type: "ADD_SCOPES",
      cx,
      thread: cx.thread,
      frame,
      [PROMISE]: client.getFrameScopes(frame),
    });

    scopes.then(() => {
      dispatch(generateInlinePreview(cx, frame.id, frame.location));
    });
  };
}

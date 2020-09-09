const url = new URL(window.location.href);

const recordingId = url.searchParams.get("id");
const dispatch = url.searchParams.get("dispatch");
const test = url.searchParams.get("test");

// During testing, make sure we clear local storage before importing
// any code that might instantiate preferences from local storage.
if (test) {
  localStorage.clear();
  require("devtools-modules").asyncStorage.clear();
}

// *** WARNING ***
//
// Do not use "import" in this file. The import will run before we clear
// the local storage above, and existing local storage contents may be used
// when running automated tests, which we don't want to happen. It would
// be good if this was less fragile...
//

require("devtools/codemirror-addons");

const { initSocket, sendMessage, log, setStatus, addEventListener } = require("protocol/socket");
const { ThreadFront } = require("protocol/thread");
const loadImages = require("image/image");
const { bootstrapApp } = require("ui/utils/bootstrap");
const FullStory = require("ui/utils/fullstory").default;
const { setupTimeline } = require("ui/actions/timeline");
const { setupMetadata } = require("ui/actions/metadata");
const { setupApp } = require("ui/actions/app");
const { setupEventListeners } = require("devtools/client/debugger/src/actions/event-listeners");
const { prefs } = require("ui/utils/prefs");

// Create a session to use while debugging.
async function createSession() {
  addEventListener("Recording.uploadedData", onUploadedData);
  addEventListener("Recording.sessionError", onSessionError);

  try {
    ThreadFront.setTest(test);
    ThreadFront.recordingId = recordingId;
    const { sessionId } = await sendMessage("Recording.createSession", {
      recordingId,
    });
    setStatus("");
    window.sessionId = sessionId;
    ThreadFront.setSessionId(sessionId);

    prefs.recordingId = recordingId;

    if (!test) {
      FullStory.setUserVars({
        recordingId,
        sessionId,
      });
    }
  } catch (e) {
    if (e.code == 9) {
      // Invalid recording ID.
      setStatus("Error: Invalid recording ID");
    } else {
      throw e;
    }
  }
}

function onUploadedData({ uploaded, length }) {
  const uploadedMB = (uploaded / (1024 * 1024)).toFixed(2);
  const lengthMB = length ? (length / (1024 * 1024)).toFixed(2) : undefined;
  if (lengthMB) {
    setStatus(`Waiting for upload… ${uploadedMB} / ${lengthMB} MB`);
  } else {
    setStatus(`Waiting for upload… ${uploadedMB} MB`);
  }
}

function onSessionError({ message }) {
  setStatus(`Error: ${message}`);
}

let initialized = false;
async function initialize() {
  if (initialized) {
    return;
  }

  initialized = true;
  loadImages();

  if (!recordingId) {
    setStatus("Recording ID not specified");
    return;
  }

  initSocket(dispatch);

  createSession();

  document.body.addEventListener("contextmenu", e => e.preventDefault());

  // Set the current mouse position on the window. This is used in places where
  // testing element.matches(":hover") does not work right for some reason.
  document.body.addEventListener("mousemove", e => {
    window.mouseClientX = e.clientX;
    window.mouseClientY = e.clientY;
  });
  window.elementIsHovered = elem => {
    const { left, top, right, bottom } = elem.getBoundingClientRect();
    const { mouseClientX, mouseClientY } = window;
    return (
      left <= mouseClientX && mouseClientX <= right && top <= mouseClientY && mouseClientY <= bottom
    );
  };
}

if (!test) {
  FullStory.init({ orgId: "VXD33", devMode: test });
}

(async () => {
  store = await bootstrapApp({ initialize }, { recordingId });
  setupApp(recordingId, store);
  setupTimeline(recordingId, store);
  setupMetadata(recordingId, store);
  setupEventListeners(recordingId, store);
})();

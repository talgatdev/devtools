/*
BSD 3-Clause License

Copyright (c) 2020, Web Replay LLC
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

const { defer, makeInfallible } = require("./utils");

let socket;
let gSocketOpen = false;

let gPendingMessages = [];
let gNextMessageId = 1;

const gMessageWaiters = new Map();

// These are helpful when investigating connection speeds.
const gStartTime = Date.now();
let gSentBytes = 0;
let gReceivedBytes = 0;

function initSocket(address) {
  socket = new WebSocket(address || "wss://dispatch.webreplay.io");

  socket.onopen = makeInfallible(onSocketOpen);
  socket.onclose = makeInfallible(onSocketClose);
  socket.onerror = makeInfallible(onSocketError);
  socket.onmessage = makeInfallible(onSocketMessage);
}

function sendMessage(method, params, sessionId, pauseId) {
  const id = gNextMessageId++;
  const msg = { id, sessionId, pauseId, method, params };

  if (gSocketOpen) {
    doSend(msg);
  } else {
    gPendingMessages.push(msg);
  }

  const { promise, resolve, reject } = defer();
  gMessageWaiters.set(id, { method, resolve, reject });

  return promise;
}

const doSend = makeInfallible(msg => {
  const str = JSON.stringify(msg);
  gSentBytes += str.length;
  socket.send(str);
});

function onSocketOpen() {
  console.log("Socket Open");
  gPendingMessages.forEach(msg => doSend(msg));
  gPendingMessages.length = 0;
  gSocketOpen = true;
}

const gEventListeners = new Map();

function addEventListener(method, handler) {
  if (gEventListeners.has(method)) {
    throw new Error("Duplicate event listener", method);
  }
  gEventListeners.set(method, handler);
}

function removeEventListener(method) {
  gEventListeners.delete(method);
}

function onSocketMessage(evt) {
  gReceivedBytes += evt.data.length;
  const msg = JSON.parse(evt.data);

  if (msg.id) {
    const { method, resolve, reject } = gMessageWaiters.get(msg.id);
    gMessageWaiters.delete(msg.id);
    if (msg.error) {
      console.warn("Message failed", method, msg.error, msg.data);
      reject(msg.error);
    } else {
      resolve(msg.result);
    }
  } else if (gEventListeners.has(msg.method)) {
    const handler = gEventListeners.get(msg.method);
    handler(msg.params);
  } else {
    console.error("Received unknown message", msg);
  }
}

function onSocketClose() {
  setStatus("Disconnected.");
  log("Socket Closed");
}

function onSocketError() {
  log("Socket Error");
}

function log(text) {
  // Don't actually log anything. This is a convenient place to add a logpoint
  // when reviewing recordings of the viewer.
}

function setStatus(text) {
  document.getElementById("status").innerText = text;
}

module.exports = {
  initSocket,
  sendMessage,
  addEventListener,
  removeEventListener,
  log,
  setStatus,
};

// Debugging methods.
if (typeof window === "object") {
  window.disconnect = () => {
    socket.close();
  };

  window.outstanding = () => {
    const messages = [...gMessageWaiters.entries()].map(([id, { method }]) => ({
      id,
      method,
    }));
    return {
      messages,
      time: Date.now() - gStartTime,
      sent: gSentBytes,
      received: gReceivedBytes,
    };
  };
}

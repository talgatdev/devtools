// Test getting a session error on startup.

import { runTest, devtoolsURL } from "../src/runTest";
import { installMockEnvironment } from "../src/mockEnvironment";
import { v4 as uuid } from "uuid";
import {
  createRecordingIsInitializedMock,
  createRecordingOwnerUserIdMock,
  createUserSettingsMock,
  createGetUserMock,
} from "../src/graphql";
import { Page } from "@recordreplay/playwright";

const recordingId = uuid();
const userId = uuid();
const user = { id: userId, uuid: userId };
const graphqlMocks = [
  createUserSettingsMock(),
  createRecordingIsInitializedMock({ recordingId, isInitialized: true }),
  createRecordingOwnerUserIdMock({ recordingId, user }),
  createGetUserMock({ user }),
];

// Test that getting a session error while loading a replay shows an appropriate error.
runTest("sessionError", async (page: Page) => {
  await page.goto(devtoolsURL({ id: recordingId }));
  await installMockEnvironment(page, { sessionError: true, graphqlMocks });
  await page.textContent("text=Unexpected session error");
});

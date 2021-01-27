import React, { ReactNode } from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { BrowserRouter as Router } from "react-router-dom";

import * as Sentry from "@sentry/react";
import { Integrations } from "@sentry/apm";

import App, { AppProps } from "ui/components/App";
const { PopupBlockedError } = require("ui/components/shared/Error");
import tokenManager from "ui/utils/tokenManager";
import useToken from "ui/utils/useToken";
import LogRocket from "ui/utils/logrocket";
import { createApolloClient } from "ui/utils/apolloClient";
import { ApolloProvider } from "@apollo/client";

import { isDevelopment, isTest } from "../environment";
import { UIStore } from "ui/actions";
const skipTelemetry = isTest() || isDevelopment();

function setupLogRocket() {
  if (skipTelemetry) {
    return;
  }

  LogRocket.init();
  LogRocket.getSessionURL(sessionURL => {
    Sentry.configureScope(scope => {
      scope.setExtra("sessionURL", sessionURL);
    });
  });
}

export function setupSentry(context: Record<string, any>) {
  const ignoreList = ["Current thread has paused or resumed", "Current thread has changed"];

  if (skipTelemetry) {
    return;
  }

  Sentry.init({
    dsn: "https://41c20dff316f42fea692ef4f0d055261@o437061.ingest.sentry.io/5399075",
    integrations: [new Integrations.Tracing()],
    tracesSampleRate: 1.0,
    beforeSend(event) {
      if (event) {
        const exceptionValue = event?.exception?.values?.[0].value;
        if (ignoreList.some(ignore => exceptionValue?.includes(ignore))) {
          return null;
        }
      }

      return event;
    },
  });

  Sentry.setContext("recording", { ...context, url: window.location.href });
}

function ApolloWrapper({ children }: { children: ReactNode }) {
  const tokenState = useToken();

  if (tokenState === undefined) {
    return null;
  }

  const { token, error } = tokenState;

  if (error) {
    if (error.message === "Could not open popup") {
      return <PopupBlockedError />;
    } else {
      return null;
    }
  }

  return <ApolloProvider client={createApolloClient(token)}>{children}</ApolloProvider>;
}

export function bootstrapApp(props: AppProps, context: Record<string, any>, store: UIStore) {
  setupSentry(context);
  setupLogRocket();

  ReactDOM.render(
    <Router>
      <tokenManager.Auth0Provider>
        <ApolloWrapper>
          <Provider store={store}>
            <App {...props} />
          </Provider>
        </ApolloWrapper>
      </tokenManager.Auth0Provider>
    </Router>,
    document.querySelector("#app")
  );
}

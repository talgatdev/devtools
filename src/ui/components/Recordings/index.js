const React = require("react");
import { connect } from "react-redux";
import { selectors } from "../../reducers";
import { Recording } from "./Recording";
import { useAuth0 } from "@auth0/auth0-react";
import Lottie from "react-lottie";
import forwardData from "image/lottie/forward.json";
import { sortBy } from "lodash";

import "./Recordings.css";

function Forward() {
  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: forwardData,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };

  return <Lottie options={defaultOptions} height={50} width={200} />;
}

const Recordings = props => {
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();
  const { recordings } = props;
  if (isLoading || (isAuthenticated && recordings === null)) {
    return (
      <div className="loading-pane">
        <Forward />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="welcome-screen">
        <div className="welcome-panel">
          <img className="logo" src="images/logo.svg" />
          <img className="atwork" src="images/computer-work.svg" />
          <button onClick={() => loginWithRedirect()}>Log In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="recordings">
      {sortBy(props.recordings, recording => -new Date(recording.date)).map((recording, i) => (
        <Recording data={recording} key={i} />
      ))}
    </div>
  );
};

export default connect(
  state => ({
    recordings: selectors.getRecordings(state),
  }),
  {}
)(Recordings);

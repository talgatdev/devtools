import { TestRun } from "ui/hooks/tests";
import MaterialIcon from "ui/components/shared/MaterialIcon";
import { getTruncatedRelativeDate } from "../../RecordingRow";
import { useContext } from "react";
import { LibraryContext } from "../../useFilters";
import { getDuration, getDurationString } from "./utils";
import { RunStats } from "./RunStats";
import { AttributeContainer } from "./AttributeContainer";

function Title({ testRun }: { testRun: TestRun }) {
  return <div>{testRun.commit?.title || "Unknown"}</div>;
}

function Attributes({ testRun }: { testRun: TestRun }) {
  const { recordings, branch, date } = testRun;
  const user = testRun.recordings[0].metadata.source?.trigger?.user;

  const duration = getDuration(testRun.recordings);
  const durationString = getDurationString(duration);

  return (
    <div className="flex flex-row items-center text-xs font-light text-gray-500">
      <AttributeContainer icon="play_circle">{testRun.event}</AttributeContainer>
      <AttributeContainer icon="fork_right">{branch}</AttributeContainer>
      <AttributeContainer icon="schedule">{getTruncatedRelativeDate(date)}</AttributeContainer>
      <AttributeContainer icon="timer">{durationString}</AttributeContainer>
      <AttributeContainer>{user!}</AttributeContainer>
      {recordings[0].metadata.source?.merge ? (
        <div
          className="flex flex-row items-center mr-4 space-x-1"
          title={recordings[0].metadata.source.merge.title}
        >
          <div className="font-bold">PR</div>
          <div>{recordings[0].metadata.source.merge.id}</div>
        </div>
      ) : null}
    </div>
  );
}

function Status({ failCount }: { failCount: number }) {
  return (
    <div className={`flex self-start ${failCount > 0 ? "text-red-500" : "text-green-600"} `}>
      <MaterialIcon iconSize="xl">radio_button_checked</MaterialIcon>
    </div>
  );
}

export function TestRunListItem({ testRun, onClick }: { testRun: TestRun; onClick: () => void }) {
  const { preview } = useContext(LibraryContext);
  const failCount = testRun.recordings.filter(r => r.metadata.test?.result !== "passed").length;
  const isSelected = preview?.id.toString() === testRun.id;
  const style = {
    backgroundColor: isSelected ? "#A3DEFA" : "",
  };

  return (
    <div
      className="flex flex-row items-center flex-grow px-4 py-3 space-x-3 overflow-hidden bg-white border-b cursor-pointer"
      style={style}
      onClick={onClick}
    >
      <Status failCount={failCount} />
      <div className="flex flex-col flex-grow space-y-1">
        <Title testRun={testRun} />
        <Attributes testRun={testRun} />
      </div>
      <RunStats testRun={testRun} />
    </div>
  );
}
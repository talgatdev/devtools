import { MouseEvent, useContext } from "react";
import MaterialIcon from "ui/components/shared/MaterialIcon";
import { Recording } from "ui/types";
import { LibraryContext } from "../useFilters";

function ViewReplay({ recordingId, passed }: { recordingId: string; passed: boolean }) {
  return (
    <a
      href={`/recording/${recordingId}`}
      target="_blank"
      rel="noreferrer noopener"
      title="View Replay"
    >
      <button className="flex items-center justify-center p-2 transition">
        <MaterialIcon
          iconSize="2xl"
          outlined
          className={passed ? "text-primaryAccent" : "text-red-500"}
        >
          play_circle
        </MaterialIcon>
      </button>
    </a>
  );
}

function Title({ recording }: { recording: Recording }) {
  const { setView, setAppliedText } = useContext(LibraryContext);
  const onViewTest = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    setView("recordings");
    setAppliedText(
      `test-path:${encodeURIComponent(JSON.stringify(recording.metadata.test!.path))}`
    );
  };

  return (
    <div className="flex flex-row items-center flex-grow space-x-2 overflow-hidden">
      <div className="flex flex-col flex-grow py-2 overflow-hidden">
        <button
          className="overflow-hidden text-left whitespace-pre overflow-ellipsis hover:underline max-w-min"
          onClick={onViewTest}
        >
          {recording.metadata.test?.title}
        </button>
        <div className="flex space-x-2 text-xs text-gray-500">{recording.metadata.test?.file}</div>
      </div>
    </div>
  );
}

export function TestResultListItem({ recording }: { recording: Recording }) {
  const { metadata } = recording;
  const passed = metadata.test?.result === "passed";
  const recordingId = recording.id;

  return (
    <a
      className={`group flex items-center border-b pr-2 transition duration-150 hover:bg-gray-100`}
      href={`/recording/${recordingId}`}
      target="_blank"
      rel="noreferrer noopener"
      title="View Replay"
    >
      <ViewReplay recordingId={recordingId} passed={passed} />
      <Title recording={recording} />
    </a>
  );
}

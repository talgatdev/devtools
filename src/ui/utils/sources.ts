import { EntityId } from "@reduxjs/toolkit";
import { newSource, SourceKind } from "@replayio/protocol";
import groupBy from "lodash/groupBy";
import omit from "lodash/omit";
import keyBy from "lodash/keyBy";
import { SourceDetails } from "ui/reducers/sources";
import newGraph from "./graph";

const fullSourceDetails = (
  attributes: Partial<SourceDetails> & {
    id: string;
    kind: SourceKind;
  }
): SourceDetails => {
  return {
    canonicalId: attributes.id,
    correspondingSourceIds: [],
    generated: [],
    generatedFrom: [],
    ...attributes,
  };
};

export const keyForSource = (source: newSource): string => {
  return `${source.url!}:${source.contentHash}`;
};

export const newSourcesToCompleteSourceDetails = (
  newSources: newSource[]
): Record<EntityId, SourceDetails> => {
  const newSourcesById = keyBy(newSources, s => s.sourceId);
  const prettyPrinted = newGraph();
  const canonical = newGraph();
  const corresponding: Record<string, string[]> = {};

  // Canonical links can go across multiple links
  const findCanonicalId = (id: string) => {
    let current = id;
    let nextNode = canonical.from(current)?.[0];

    while (nextNode && nextNode !== current) {
      current = nextNode;
      nextNode = canonical.from(current)?.[0];
    }

    return current;
  };

  const generated = newGraph();
  newSources.forEach((source: newSource) => {
    // We handle pretty-printed (pp) files and their generated links a little
    // differently. Because Replay makes the pp sources, their structure is
    // predictable. All pp sources will have one generatedSourceId, and it will
    // be the minified source.
    if (source.kind === "prettyPrinted") {
      return;
    }

    source.generatedSourceIds?.map(generatedId => {
      generated.connectNode(source.sourceId, generatedId);
    });
  });

  // Sources are processed by kind. So first we go through the whole list once
  // just to group things properly.
  const byKind = groupBy(newSources, source => source.kind);

  const inlineScripts = byKind["inlineScript"] || [];
  inlineScripts.forEach(source => {
    canonical.connectNode(source.sourceId, generated.to(source.sourceId)![0]);
  });

  const sourceMapped = byKind["sourceMapped"] || [];
  sourceMapped.forEach(source => {
    canonical.connectNode(generated.from(source.sourceId)![0], source.sourceId);
  });

  // TODO @jcmorrow: remove this once we include the contentHash with prettyPrinted sources
  const contentHashForSource = (source: newSource) => {
    return source.kind === "prettyPrinted"
      ? newSourcesById[source.generatedSourceIds![0]].contentHash
      : source.contentHash;
  };

  const keyForSource = (source: newSource): string => {
    return `${source.kind}:${source.url!}:${contentHashForSource(source)}`;
  };

  newSources.forEach(source => {
    const key = keyForSource(source);
    if (corresponding[key] === undefined) {
      corresponding[key] = [];
    }
    corresponding[key].push(source.sourceId);
  });

  const returnValue: Record<EntityId, SourceDetails> = {};

  const prettyPrintedSources = byKind["prettyPrinted"] || [];
  prettyPrintedSources.forEach(source => {
    const nonPrettyPrintedVersionId = source.generatedSourceIds![0];
    prettyPrinted.connectNode(nonPrettyPrintedVersionId, source.sourceId);
    canonical.connectNode(source.sourceId, nonPrettyPrintedVersionId);
  });

  newSources.forEach(source => {
    returnValue[source.sourceId] = fullSourceDetails({
      ...omit(source, "sourceId", "generatedSourceIds"),
      contentHash: contentHashForSource(source),
      correspondingSourceIds: corresponding[keyForSource(source)],
      id: source.sourceId,
      prettyPrinted: prettyPrinted.from(source.sourceId)?.[0],
      prettyPrintedFrom: prettyPrinted.to(source.sourceId)?.[0],
      generated: generated.from(source.sourceId) || [],
      generatedFrom: generated.to(source.sourceId) || [],
      canonicalId: findCanonicalId(source.sourceId),
    });
  });

  return returnValue;
};

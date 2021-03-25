import { ApolloError } from "@apollo/client";

export type Status =
  | {
      type: "input";
    }
  | {
      type: "submitted-email";
    }
  | {
      type: "fetched-user";
      userId: string;
      error?: ApolloError;
    }
  | {
      type: "submitted-user";
      error?: ApolloError;
    };

export type StatusTypes = "input" | "submitted-email" | "fetched-user" | "submitted-user";
export type Role = "owner" | "collaborator";

export interface RecordingDbData {
  user: User;
  id: string;
  is_private: boolean;
}

export interface CollaboratorDbData {
  user_id: string;
  recording_id: string;
  user: User;
}

export interface User {
  email: string;
  id: string;
  name: string;
  nickname: string;
  picture: string;
}

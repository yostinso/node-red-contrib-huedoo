import { ResourceResponse } from "./resource";

type UpdateId = string;

export interface EventUpdateResponse<T extends ResourceResponse<any>> {
    type: "update" | "add" | "delete" | "error";
    id: UpdateId;
    creationtime: "string";
    data: T;
}
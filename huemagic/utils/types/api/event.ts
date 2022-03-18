import { RealResourceType } from "../resources/generic";
import { ResourceResponse } from "./resource";

type UpdateId = string;

export interface EventUpdateResponse<T extends Partial<ResourceResponse<RealResourceType>>> {
    type: "update" | "add" | "delete" | "error";
    id: UpdateId;
    creationtime: string;
    data: T;
}
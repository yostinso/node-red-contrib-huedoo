import { Light } from "./light";

type UpdateId = string;

export type EventData = Light | Scene | Button;
export type EventUpdate = {
    type: "update";
    id: UpdateId;
    creationTime: "string";
    data: EventData[];
}
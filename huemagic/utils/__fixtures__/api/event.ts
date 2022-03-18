import { EventUpdateResponse } from "../../types/api/event"
import { ResourceResponse } from "../../types/api/resource";
import { Device } from "../../types/resources/device"
import { RealResourceType } from "../../types/resources/generic";
import uuid from "./uuid";
const dayjs = jest.requireActual("dayjs");

const eventTemplate: EventUpdateResponse<Device> = {
    type: "update",
    id: uuid(),
    creationtime: dayjs().format(),
    data: {
        id: "new_device",
        id_v1: "/device/1",
        type: "device"
    }
};

type GenericEvent = EventUpdateResponse<Partial<ResourceResponse<RealResourceType>>>;
type EventType = GenericEvent["type"];

export function makeEvent<R extends ResourceResponse<RealResourceType>>(id: string = uuid(), type: EventType = "update", resource?: R, extras: Partial<GenericEvent> = {}): EventUpdateResponse<ResourceResponse<RealResourceType>> {
    let data = resource || eventTemplate.data;
    return {
        ...eventTemplate,
        id,
        type,
        creationtime: dayjs().format(),
        ...extras,
        data: { ...data, ...extras.data },
    };
}
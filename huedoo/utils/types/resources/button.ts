import { isResourceType, OwnedResource, RealResource } from "./generic";

export type ButtonControlIdType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type ButtonEventType = "initial_press" | "repeat" | "short_release" | "long_release" | "double_short_release";
export interface Button extends OwnedResource<"button"> {
    metadata?: {
        control_id: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    }
    button?: {
        last_event: ButtonEventType
    }
}
export function isButton(resource: RealResource<any>): resource is Button {
    return isResourceType(resource, "button");
}

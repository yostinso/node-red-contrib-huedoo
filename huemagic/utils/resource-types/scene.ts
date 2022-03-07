import { GenericBasicResource } from "./generic";

export interface Button extends GenericBasicResource {
    type: "button";
    metadata?: {
        control_id: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    }
    button?: {
        last_event: "initial_press" | "repeat" | "short_release" | "long_release" | "double_short_release"
    }
}
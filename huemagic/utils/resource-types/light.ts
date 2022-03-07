import { ColorSettings } from "./color";
import { GenericBasicResource, ResourceRef } from "./generic";

export interface Light extends GenericBasicResource, ColorSettings {
    type: "light"
    dynamics?: {
        speed: number;
        status: "dynamic_palette" | "none";
        status_values: string[]; // ? array of SupportedDynamicStatus
        speed_valid: boolean;
    }
    alert?: {
        action_values: string[]; // ? array of AlertEffectType
    }
    mode?: "normal" | "streaming";
    metadata?: { name: string; }
}
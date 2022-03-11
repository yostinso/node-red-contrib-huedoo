import { ColorSettings } from "../color";
import { RealResource, ResourceRef } from "./generic";

export interface Light extends RealResource<"light">, ColorSettings {
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
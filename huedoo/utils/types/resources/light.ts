import { ColorSettings } from "../color";
import { OwnedResource } from "./generic";

export interface Light extends OwnedResource<"light">, ColorSettings {
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
    effects?: {
        effect_values: string[];
        status_values: string[];
        status: string;
    }
    metadata?: {
        name: string;
        archetype?: string;
    }
}
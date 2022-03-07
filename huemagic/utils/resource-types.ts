import { resourceUsage } from "process";

export type ResourceId = string;
type UpdateId = string;

export type ResourceType = "light" | "scene" | "room" | "zone" | "bridge_home" | "grouped_light" |
	"device" | "bridge" | "device_power" | "zigbee_connectivity" | "zgp_connectivity" |
	"motion" | "temperature" | "light_level" | "button" | "behavior_script" |
	"behavior_instance" | "geofence_client" | "geolocation" | "entertainment_configuration" |
	"entertainment" | "homekit" | "all" | "rule";

export type Resource = {
    id: ResourceId;
    type: ResourceType;
}

export type ResourceRef = {
    rid: ResourceId;
    rtype: ResourceType;
}

export type ResourceList = ResourceRef[];

type LightRef = ResourceRef & { rtype: "light"; }
type DeviceRef = ResourceRef & { rtype: "device"; }

export interface BaseResourceData {
    id: ResourceId; // UUID
    id_v1: string;  // /lights/32
}

export interface BasicResource extends BaseResourceData {
    type: "light" | "scene" | "grouped_light" | "bridge" | "device_power" |
          "zigbee_connectivity" | "zgp_connectivity" | "motion" | "temperature" |
          "light_level" | "button" | "behavior_script" | "behavior_instance" |
          "geofence_client" | "geolocation" | "entertainment_configuration" |
          "entertainment" | "homekit";
    owner?: ResourceRef
}

export interface BasicServiceResource extends BaseResourceData {
    type: "device" | "room" | "zone" | "bridge_home";
    services: ResourceRef[];
    grouped_services?: ResourceRef[]
}
export type BasicResourceUnion = BasicResource | BasicServiceResource;

type XYColor = { x: number, y: number };
type HueColorGamut = { blue: XYColor, red: XYColor, green: XYColor };
type GamutType = "A" | "B" | "C" | "other";
type GradientColor = { color: { xy: XYColor; } }

type ColorSettings = {
    on?: { on: boolean };
    dimming?: { brightness: number; }
    color_temperature?: {
        mirek?: number;
        mirek_valid?: boolean;
        mirek_schema?: { mirek_minimum: number, mirek_maximum: number };
    }
    color?: {
        xy: XYColor;
        gamut: HueColorGamut;
        gamut_type: GamutType;
    }
    gradient?: {
        points: GradientColor[];
        points_capable: number;
    }
}

export interface Light extends BasicResource, ColorSettings {
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

type MetadataImage = {
    rid: ResourceId;
    rtype: "public_image";
}
type ColorPaletteGet = {
    color: { xy: XYColor }
    dimming: { brightness: number }
}
type DimmingFeatureBasicGet = {
    brightness: number;
}
type ColorTemperaturePaletteGet = {
    color_temperature: { mirek: number; }
    dimming: { brightness: number }
}
export interface Scene extends BasicResource {
    type: "scene";
    metadata?: {
        name: string;
        image?: MetadataImage
    }
    group: {
        rid: ResourceId;
        rtype: ResourceType; // Can this actually change?
    }
    actions: {
        target: ResourceRef;
        action: ColorSettings;
    }[]
    palette: {
        color: ColorPaletteGet[]
        dimming: DimmingFeatureBasicGet[]
        color_temperature: ColorTemperaturePaletteGet[]
    }
    speed: number;
}
export interface Button extends BasicResource {
    type: "button";
    metadata?: {
        control_id: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    }
    button?: {
        last_event: "initial_press" | "repeat" | "short_release" | "long_release" | "double_short_release"
    }
}

type ServiceResource = {
    services: LightRef 
}

export type EventData = Light | Scene | Button;
export type EventUpdate = {
    type: "update";
    id: UpdateId;
    creationTime: "string";
    data: EventData[];
}
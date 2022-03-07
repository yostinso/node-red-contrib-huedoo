
export type ResourceList = ResourceRef[];

type LightRef = ResourceRef & { rtype: "light"; }
type DeviceRef = ResourceRef & { rtype: "device"; }

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

type ServiceResource = {
    services: LightRef 
}

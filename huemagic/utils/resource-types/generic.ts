export type ResourceId = string;

export interface ResourceRef<T extends OwnedResourceType> {
    rid: ResourceId;
    rtype: T;
}

export type ServiceOwnerResourceType = "device" | "room" | "zone" | "bridge_home"

export type OwnedResourceType =
    "device" | "bridge_home" | "room" | "zone" | "light" | "button" | "temperature" |
    "light_level" | "motion" | "entertainment" | "grouped_light" | "device_power" |
    "zigbee_bridge_connectivity" | "zigbee_connectivity" | "zgp_connectivity" |
    "bridge" | "homekit" | "scene" | "entertainment_configuration" | "public_image" |
    "auth_v1" | "behavior_script" | "behavior_instance" | "geofence" |
    "geofence_client" | "geolocation"

export type SpecialResourceType = "all" | "rule" | "group";
export type RealResourceType = ServiceOwnerResourceType | OwnedResourceType;

export type ResourceType = RealResourceType | SpecialResourceType;

interface BaseResourceData {
    id: ResourceId; // UUID
    id_v1: string;  // /lights/32
}

export interface GenericBasicResource extends BaseResourceData {
	updated?: string;
	types?: [ ResourceType ]
    type: "light" | "scene" | "grouped_light" | "device_power" |
          "zigbee_connectivity" | "zgp_connectivity" | "motion" | "temperature" |
          "light_level" | "button" | "behavior_script" | "behavior_instance" |
          "geofence_client" | "geolocation" | "entertainment_configuration" |
          "entertainment" | "homekit";
    owner?: ResourceRef
}
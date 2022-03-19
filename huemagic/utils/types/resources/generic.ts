import { realpath } from "fs";
import { Resource } from "../api/resource";

export type ResourceId = string;

export interface ResourceRef<T extends OwnedResourceType> {
    rid: ResourceId;
    rtype: T;
}

export const serviceOwnerResourceTypes = [ "device", "room", "zone", "bridge_home" ] as const;
export type ServiceOwnerResourceType  = (typeof serviceOwnerResourceTypes)[number];
export function isServiceOwnerType(type: string): type is ServiceOwnerResourceType {
    return serviceOwnerResourceTypes.includes(type as ServiceOwnerResourceType);
}

const ownedResourceTypes = [
    "device", "bridge_home", "room", "zone", "light", "button", "temperature",
    "light_level", "motion", "entertainment", "grouped_light", "device_power",
    "zigbee_bridge_connectivity", "zigbee_connectivity", "zgp_connectivity",
    "bridge", "homekit", "scene", "entertainment_configuration", "public_image",
    "auth_v1", "behavior_script", "behavior_instance", "geofence",
    "geofence_client", "geolocation", "rule"
] as const;
export type OwnedResourceType = (typeof ownedResourceTypes)[number];
export function isOwnedResourceType(type: string): type is OwnedResourceType {
    return ownedResourceTypes.includes(type as OwnedResourceType);
}

export type SpecialResourceType = "all" | "group";
export type RealResourceType = ServiceOwnerResourceType | OwnedResourceType;

export type ResourceType = RealResourceType | SpecialResourceType;

const basicResourceTypes = [
    "light", "scene", "grouped_light", "device_power",
    "zigbee_connectivity", "zgp_connectivity", "motion", "temperature",
    "light_level", "button", "behavior_script", "behavior_instance",
    "geofence_client", "geolocation", "entertainment_configuration",
    "entertainment", "homekit"
];
export type BasicResourceType = (typeof basicResourceTypes)[number];
export function isBasicResourceType(type: string): type is BasicResourceType {
    return basicResourceTypes.includes(type as BasicResourceType);
}
export interface RealResource<T extends RealResourceType> {
    id: ResourceId;
    type: T;
    id_v1?: string;
}
export interface SpecialResource<T extends SpecialResourceType> {
    id: ResourceId;
    type: T;
    id_v1?: string;
    updated: string;
}

export interface OwnedResource<T extends OwnedResourceType> extends RealResource<T> {
    owner?: ResourceRef<RealResourceType>
}
export function isOwnedResource(resource: Resource<any>): resource is OwnedResource<OwnedResourceType> {
    return isOwnedResourceType(resource.type);
}

export interface ServiceOwnerResource<T extends ServiceOwnerResourceType> extends OwnedResource<T> {
    services?: ResourceRef<OwnedResourceType>[]
    grouped_services?: ResourceRef<OwnedResourceType>[]
}
/*
export interface ServiceOwnerResource<T extends ServiceOwnerResourceType> extends OwnedResource<T> {
    services?: {
        [type in OwnedResourceType]+?: {
            [id: ResourceId]: ResourceRef<type>
        }
    }
    grouped_services?: ResourceRef<OwnedResourceType>[]
}
*/
export function isServiceOwnerResource(resource: Resource<any>): resource is ServiceOwnerResource<ServiceOwnerResourceType> {
    return isServiceOwnerType(resource.type);
}

export function isResourceType<T extends RealResourceType>(item: RealResource<any>, type: T): item is RealResource<T> {
    return item.type == type;
}
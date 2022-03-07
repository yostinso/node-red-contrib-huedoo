import { OwnedResourceType, RealResourceType, ResourceId, ResourceRef, ServiceOwnerResourceType } from "../generic";
import { BridgeConfig } from "./api";

export type AllResourcesRequestArgs = {
	method?: "GET";
	config: BridgeConfig;
	data?: undefined;
	resource: "all";
	version?: 2;
}
export interface Resource<T extends RealResourceType> {
    type: T;
}

export type ResourceRequestArgs = {
	method?: "GET";
	resource: RealResourceType | null;
	data?: object | string | null;
	config: BridgeConfig | null;
	version?: 1 | 2;
}

export interface ResourceResponse<T extends RealResourceType> {
    type: T;
}

export interface OwnedResourceResponse<T extends OwnedResourceType> extends ResourceResponse<T> {
    owner?: ResourceRef<T>
}

export interface ServiceOwnerResourceResponse<T extends ServiceOwnerResourceType> extends ResourceResponse<T> {
    services?: {
        [type in OwnedResourceType]+?: {
            [id: ResourceId]: ResourceRef<any>
        }
    }
    grouped_services?: ResourceRef<any>[]
}
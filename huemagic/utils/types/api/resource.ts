import { OwnedResource, OwnedResourceType, RealResource, RealResourceType, ResourceId, ResourceRef, ServiceOwnerResource, ServiceOwnerResourceType } from "../resources/generic";
import { ApiRequestV2, ApiResponseData, ApiResponseV2, BridgeConfig } from "./api";

export interface Resource<T extends RealResourceType> {
	id: ResourceId;
    type: T;
}

export interface ResourceRequest<T extends RealResourceType> extends ApiRequestV2<ResourceId> {
	method: "GET";
	resource: T;
	data: ResourceId;
	config: BridgeConfig;
}
export interface ResourcesRequest<T extends RealResourceType> extends ApiRequestV2<ResourceId> {
	method: "GET";
	config: BridgeConfig;
	resource: T;
	data: ResourceId;
}
export interface AllResourcesRequest extends ApiRequestV2<undefined> {
	method: "GET";
	config: BridgeConfig;
}

export interface ResourceResponse<T extends RealResourceType> extends RealResource<T>, ApiResponseData {
}

export type OwnedResourceResponse<T extends OwnedResourceType> = OwnedResource<T>;
export type ServiceOwnerResourceResponse<T extends ServiceOwnerResourceType> = ServiceOwnerResource<T>;
import { OwnedResource, OwnedResourceType, RealResource, RealResourceType, ResourceId, ResourceRef, ResourceType, ServiceOwnerResource, ServiceOwnerResourceType } from "../resources/generic";
import { ApiRequestV2, ApiResponseData, ApiResponseV2, BridgeConfig } from "./api";

export interface Resource<T extends ResourceType> {
	id: ResourceId;
    type: T;
}

export interface ResourceRequest<T extends RealResourceType> extends ApiRequestV2<ResourceId> {
	resource: T;
	data: ResourceId;
	config: BridgeConfig;
}
export interface ResourcesRequest<T extends RealResourceType> extends ApiRequestV2<ResourceId> {
	config: BridgeConfig;
	resource: T;
}
export interface AllResourcesRequest extends ApiRequestV2<undefined> {
	config: BridgeConfig;
}

export interface ResourceResponse<T extends RealResourceType> extends RealResource<T>, ApiResponseData {
}

export type OwnedResourceResponse<T extends OwnedResourceType> = OwnedResource<T>;
export type ServiceOwnerResourceResponse<T extends ServiceOwnerResourceType> = ServiceOwnerResource<T>;
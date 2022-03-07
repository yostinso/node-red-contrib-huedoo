import { OwnedResourceResponse, Resource, ResourceResponse, ServiceOwnerResourceResponse } from "../resource-types/api/resource";
import { OwnedResourceType, RealResourceType, ResourceId, ResourceRef, ServiceOwnerResourceType } from "../resource-types/generic";

/*
Expanded resources replace ServiceRefs with the full device details, specifically:
ServiceOwnerResourceTypes have .services[]
OwnedResourceTypes have .owner
*/

interface ExpandedResourceExtras {
	types?: RealResourceType[]
	updated?: string;
}

export interface ExpandedOwnedResourceResponse<T extends OwnedResourceType> extends ResourceResponse<T>, ExpandedResourceExtras {
    owner?: Resource<T>
}

export interface ExpandedServiceOwnerResourceResponse<T extends ServiceOwnerResourceType> extends ResourceResponse<T>, ExpandedResourceExtras {
    owner?: Resource<T>
    services?: {
        [type in OwnedResourceType]+?: {
            [id: ResourceId]: Resource<any>
        }
    }
	grouped_services?: {
        [groupedServiceId: ResourceId]: ResourceId[]
    }
}

type ExpandedResourceResponse = ExpandedOwnedResourceResponse<any> | ExpandedServiceOwnerResourceResponse<any>;
type AllResources = { [id: ResourceId]: ResourceResponse<any> };

function expandOwnedResourceResponse(resource: OwnedResourceResponse<any>, allResources: AllResources): ExpandedOwnedResourceResponse<any> {
    if (resource.owner) {
        return {
            ...resource,
            owner: allResources[resource.owner.rid]
        }
    } else {
        return { ...resource, owner: undefined };
    }
}
function expandServiceOwnerResourceResponse(resource: ServiceOwnerResourceResponse<any>, allResources: AllResources): [ ExpandedServiceOwnerResourceResponse<any>, GroupedServices? ] {
    if (resource.services) {
        let expandedServices: { [type in OwnedResourceType]+?: { [id: ResourceId]: Resource<any> } } = {};
        Object.entries(resource.services).forEach(([ type, services ]) => {
            expandedServices[type] = {};
            Object.entries(services).forEach(([id, ref]) => {
                expandedServices[id] = allResources[ref.rid];
            });
        });

        let groupedServices = {};
        if (resource.grouped_services) {
            // TODO groupedServices
            resource.grouped_services.forEach()
        }
        return [ { ...resource, services: expandedServices }, groupedServices ];
    } else {
        return [{ ...resource, services: undefined, grouped_services: undefined }, undefined];
    }
}
function expand(resource: OwnedResourceResponse<any> | ServiceOwnerResourceResponse<any>, allResources: AllResources): ExpandedResourceResponse {
    if ("owner" in resource) {
        return expandOwnedResourceResponse(resource, allResources);
    } else {
        // TODO: Handled groupedServices
        return expandServiceOwnerResourceResponse(resource, allResources);
    }
}

/*
export interface ExpandedBasicServiceResource extends BaseResourceData {
	types?: ResourceType[]
	updated?: string;
    type: "device" | "room" | "zone" | "bridge_home";
	services: { [type: string]: { [id: ResourceId]: ExpandedResource } }
	types?: ResourceType[]
	updated?: string;
	grouped_services?: ResourceRef[];
}
export type ExpandedBasicResource = GenericExpandedBasicResource | Light;
*/
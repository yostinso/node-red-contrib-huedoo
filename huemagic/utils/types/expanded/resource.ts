import { all } from "async";
import { group } from "console";
import { Resource, ResourceResponse } from "../api/resource";
import { isOwnedResourceType, isServiceOwnerType, OwnedResource, OwnedResourceType, RealResourceType, ResourceId, ResourceRef, ServiceOwnerResource, ServiceOwnerResourceType } from "../resources/generic";

/*
Expanded resources replace ServiceRefs with the full device details, specifically:
ServiceOwnerResourceTypes have .services[]
OwnedResourceTypes have .owner
*/

export interface ExpandedResource<T extends RealResourceType> extends Resource<T> {
	types?: RealResourceType[]
	updated?: string;
}

export interface ExpandedOwnedResource<T extends OwnedResourceType> extends ExpandedResource<T> {
    owner?: Resource<T>;
    services: undefined;
}

export interface ExpandedServiceOwnerResource<T extends ServiceOwnerResourceType> extends ExpandedResource<T> {
    owner?: Resource<T>
    services?: {
        [T in OwnedResourceType]+?: {
            [id: ResourceId]: Resource<T>
        }
    }
}
export function isExpandedServiceOwnerResource(resource: Resource<any>): resource is ExpandedServiceOwnerResource<ServiceOwnerResourceType> {
    return isServiceOwnerType(resource.type);
}

type UnexpandedResources = { [id: ResourceId]: ResourceResponse<any> };
type ExpandedResources = { [id: ResourceId]: ExpandedResource<any> }
export type GroupedServices = { [groupedServiceId: ResourceId]: ResourceId[] };
export type ExpandedOwnedServices = { [T in OwnedResourceType]+?: { [id: ResourceId]: ExpandedResource<T> } }


function expandOwnedResourceResponse(resource: OwnedResource<any>, allResources: UnexpandedResources): ExpandedOwnedResource<any> {
    if (resource.owner) {
        return {
            ...resource,
            owner: allResources[resource.owner.rid],
            services: undefined,
        }
    } else {
        return { ...resource, owner: undefined, services: undefined };
    }
}

function expandServiceOwnerResourceResponse(resource: ServiceOwnerResource<any>, allResources: UnexpandedResources): [ ExpandedServiceOwnerResource<any>, GroupedServices? ] {
    if (resource.services) {
        // Expand the services
        let expandedServices: { [type in OwnedResourceType]+?: { [id: ResourceId]: ExpandedResource<any> } } = {};
        Object.entries(resource.services).forEach(([ type, services ]) => {
            if (isOwnedResourceType(type)) { // Runtime validation that object key is an OwnedResourceType since it can only be typed as string
                let servicesForType = expandedServices[type] || {};
                Object.entries(services).forEach(([id, ref]) => {
                    servicesForType[id] = allResources[ref.rid]; // ! means "I promise I just made this an object and it's not undefined"
                });
                expandedServices[type] = servicesForType;
            }
        });

        let groupedServices: GroupedServices = {};
        if (resource.grouped_services) {
            // TODO groupedServices
            resource.grouped_services.forEach((service: ResourceRef<any>) => {
                groupedServices[service.rid] ||= [];
                groupedServices[service.rid].push(resource.id);
            })
        }

        // Expand the owner too:
        let expandedOwner = undefined;
        if (resource.owner !== undefined) {
            expandedOwner = expandOwnedResourceResponse(resource, allResources).owner;
        }

        return [ {
            ...resource,
            services: expandedServices,
            owner: expandedOwner
        }, groupedServices ];
    } else {
        return [{ ...resource, services: undefined, owner: undefined }, undefined];
    }
}
function expandResource(resource: OwnedResource<any> | ServiceOwnerResource<any>, allResources: UnexpandedResources): [ ExpandedResource<any>, GroupedServices? ] {
    if ("services" in resource) {
        return expandServiceOwnerResourceResponse(resource, allResources);
    } else if ("owner" in resource) {
        return [ expandOwnedResourceResponse(resource, allResources), undefined ];
    } else {
        return [ resource, undefined ];
    }
}

export function expandedResources(allResources: ResourceResponse<any>[]): [ ExpandedResources, GroupedServices ] {
    let groupedServices: GroupedServices = {};
    let expandedResources: ExpandedResources = {};

    let resourcesById = allResources.reduce<{ [id: ResourceId]: ResourceResponse<any> }>((memo, resource) => {
        memo[resource.id] = resource;
        return memo;
    }, {});

    Object.values(resourcesById).forEach((resource) => {
        let [ expanded, groups ] = expandResource(resource, resourcesById);

        expandedResources[resource.id] = expanded;

        if (groups !== undefined) {
            Object.entries(groups).forEach(([parentId, childIds]) => {
                let existingChildren = groupedServices[parentId] || [];
                groupedServices[parentId] = [ ...existingChildren, ...childIds ];
            });
        }
    });

    return [ expandedResources, groupedServices ];
}

type Keys = "a" | "b" | "c";
interface ValueGeneric<T extends Keys> {
    type: Keys
    x?: any
}
type Mapped = { [T in Keys]+?: ValueGeneric<T> }
const a: Mapped = {};
a["a"] = { x: 1, type: "a" }

let typeB: Keys = "b";
const b: ValueGeneric<Keys> = { x: 2, type: typeB }
a[b.type] = b;

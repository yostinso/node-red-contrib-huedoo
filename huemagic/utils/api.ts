import axios, { AxiosRequestConfig } from "axios";
import dayjs from 'dayjs';
import https from 'https';
import EventSource from 'eventsource';
import { Resource, ResourceRef, ResourceId, BasicResourceUnion, ResourceType, EventUpdate, EventData, BaseResourceData, BasicServiceResource, BasicResource, ResourceList } from "./resource-types";
import { TypedBridgeV1Response, TypedRulesV1ResponseItem } from "./messages";

export type AnyResponse = RulesV1ResponseItem | BridgeV1Response | BasicResourceUnion;
export type AnyResource = TypedRulesV1ResponseItem | TypedBridgeV1Response | BasicResourceUnion;

export type RulesRequestArgs = {
	method?: "GET";
	config: Config;
	data?: undefined;
	resource: "/rules";
	version: 1;
}
export type RulesV1ResponseItem = {
    name: string;
    lasttriggered: string;
    creationtime: string;
    timestriggered: number;
    owner: string;
    status: string;
    conditions: {
        address: string;
        operator: string;
        value?: string;
    }[]
    actions: {
        address: string;
        method: "GET" | "PUT" | "DELETE";
        body: object
    }[]
};
export type RulesV1Response = {
    [ index: string ]: RulesV1ResponseItem
};

export type BridgeRequestArgs = {
	method?: "GET";
	config: Config;
	data?: undefined;
	resource: "/config";
	version: 1;
}
export type BridgeV1Response = {
    name: string;
	bridgeid: string;
	factorynew: boolean;
	replacesbridgeid: string;
	datastoreversion: string;
	starterkitid: string;
	swversion: string;
	apiversion: string;
	ipaddress: string;
	netmask: string;
	gateway: string;
	proxyaddress: string;
	proxyport: number;
	UTC: string;
	timezone: string;
	localtime: string;
	portalservices: boolean;
	portalconnection: string;
	linkbutton: boolean;
	updated: string;
	modelid: string;
    zigbeechannel: number;
    mac: string;
    dhcp: boolean;

	whitelist: {
		[ id: string ]: {
			"last use date": string;
			"create date": string;
			name: string;
		}
	}
};
export type BridgeAutoupdateArgs = BridgeRequestArgs & {
	config: Config;
	resource: "/config";
	version: 1;
	method: "PUT";
	data: {
		swupdate2: {
			checkforupdate: boolean;
			install: boolean;
		}
	}
}

export type AllResourcesRequestArgs = {
	method?: "GET";
	config: Config;
	data?: undefined;
	resource: "all";
	version?: 2;
}
export type AllResourcesResponse = BasicResourceUnion[];

type Config = {
	bridge: string;
	key: string;
}
type ConfigWithId = Config & {
	id: string;
}

type InitArgs = { config: Config | null }
export type ResourceRequestArgs = {
	method?: "GET";
	resource: ResourceType | null;
	data?: object | string | null;
	config: Config | null;
	version?: 1 | 2;
}

type RequestArgs = BridgeAutoupdateArgs | RulesRequestArgs | BridgeRequestArgs | ResourceRequestArgs | AllResourcesRequestArgs;
type RequestResponse = RulesV1Response | BridgeV1Response | BasicResourceUnion | AllResourcesResponse;

interface ExpandedBasicServiceResource extends BaseResourceData {
	types?: ResourceType[]
	updated?: string;
    type: "device" | "room" | "zone" | "bridge_home";
	services: { [type: string]: { [id: ResourceId]: ExpandedResource } }
	grouped_services?: ResourceRef[];
}
interface ExpandedBasicResource extends BaseResourceData {
	updated?: string;
	types?: [ ResourceType ]
    type: "light" | "scene" | "grouped_light" | "bridge" | "device_power" |
          "zigbee_connectivity" | "zgp_connectivity" | "motion" | "temperature" |
          "light_level" | "button" | "behavior_script" | "behavior_instance" |
          "geofence_client" | "geolocation" | "entertainment_configuration" |
          "entertainment" | "homekit";
    owner?: Resource
}

export type ExpandedResource = ExpandedBasicResource | ExpandedBasicServiceResource | TypedBridgeV1Response | TypedRulesV1ResponseItem;

function expandResourceLinks(resource: AnyResource, allResources: { [id: string]: AnyResource }): ExpandedResource {
	// We either have an owner _OR_ we have services
	if (resource.type == "device" || resource.type == "room" || resource.type == "zone" || resource.type == "bridge_home") {
		// RESOLVE SERVICES
		let allServices: {
			[ targetType: string ]: { [targetId: ResourceId ]: ExpandedResource }
		} = {};

		resource.services.forEach((service: ResourceRef) => {
			// Find the full-size service in allResources
			const fullResource = expandResourceLinks(allResources[service.rid], allResources); // I think unnecessary because no nesting?
			if (!allServices[service.rtype]) { allServices[service.rtype] = {}; }
			allServices[service.rtype][service.rid] = fullResource;
		});

		// REPLACE SERVICES
		let completeResource: ExpandedBasicServiceResource = {
			...resource,
			services: allServices
		}
		return completeResource;
	} else if ("owner" in resource && resource.owner) {
		let ownerRid = resource.owner.rid;
		return expandResourceLinks(allResources[ownerRid], allResources);
	} else {
		// No need for lookup/expansion; just clone
		if ("services" in resource) {
			throw new Error(`Unexpected 'services' key in non-group resource ${resource.type}`);
		} else if ("owner" in resource) {
			throw new Error(`Unexpected 'owner' key in non-group resource ${resource.type}`);
		} else {
			// I didn't bother to make a type "BasicResrouceWithoutRefs"...
			return { ...resource } as unknown as ExpandedResource;
		}
	}
}

export type ProcessedResources = { [ id: ResourceId ]: ExpandedResource };
export type GroupsOfResources = { [groupedServiceId: ResourceId ]: string[] };

class API {
	// EVENTS
	private static events: {
		[targetId: string]: EventSource
	} = {};

	//
	// INITIALIZE
	static init({ config = null }: InitArgs) {
		// GET BRIDGE
		return new Promise(function(resolve, reject) {
			if(!config) {
				reject("Bridge is not configured!");
				return false;
			}

			// GET BRIDGE INFORMATION
			axios({
				"method": "GET",
				"url": "https://" + config.bridge + "/api/config",
				"headers": { "Content-Type": "application/json; charset=utf-8" },
				"httpsAgent": new https.Agent({ rejectUnauthorized: false }),
			})
			.then(function(response) {
				resolve(response.data);
			})
			.catch(function(error) {
				reject(error);
			});
		});
	}

	//
	// MAKE A REQUEST
	static request(opts: BridgeAutoupdateArgs): Promise<BridgeV1Response>;
	static request(opts: RulesRequestArgs): Promise<RulesV1Response>;
	static request(opts: BridgeRequestArgs): Promise<BridgeV1Response>;
	static request(opts: AllResourcesRequestArgs): Promise<AllResourcesResponse>;
	static request(opts: ResourceRequestArgs): Promise<BasicResourceUnion>;
	static request({ config = null, method = 'GET', resource = null, data = null, version = 2 }: RequestArgs): Promise<RequestResponse> {
		return new Promise((resolve, reject) => {
			if(!config) {
				reject("Bridge is not configured!");
				return false;
			}

			// BUILD REQUEST OBJECT
			let request: AxiosRequestConfig = {
				"method": method,
				"url": "https://" + config.bridge,
				"headers": {
					"Content-Type": "application/json; charset=utf-8",
					"hue-application-key": config.key
				},
				"httpsAgent": new https.Agent({ rejectUnauthorized: false }), // Node is somehow not able to parse the official Philips Hue PEM
			};

			// HAS RESOURCE? -> APPEND
			if(resource !== null) {
				let resourceKey: string = resource;
				switch (version) {
					case 1:
						request['url'] += "/api/" + config.key + resource;
						break;
					case 2:
						resourceKey = (resource !== "all") ? `/${resource}` : "";
						request['url'] += "/clip/v2/resource" + resourceKey;
						break;
					default:
						reject(`Invalid version ${version} passed to API.request`);
						return false;
				}
			}

			// HAS DATA? -> INSERT
			if(data !== null) { request.data = data; }

			// RUN REQUEST
			axios(request).then((response) => {
				if (version === 2) {
					if (response.data.errors.length > 0) {
						reject(response.data.errors);
					} else {
						resolve(response.data.data);
					}
				} else if (version === 1) {
					if (resource === "/rules") {
						resolve(response.data as RulesV1Response);
					} else if (resource === "/config") {
						resolve(response.data as BridgeV1Response);
					} else {
						resolve(response.data);
					}
				}
			})
			.catch(function(error) {
				reject(error);
			});
		});
	}

	//
	// SUBSCRIBE TO BRIDGE EVENTS
	static subscribe(config: ConfigWithId, callback: (data: EventData[]) => void) {
		return new Promise((resolve, reject) => {
			if(!this.events[config.id]) {
				var sseURL = "https://" + config.bridge + "/eventstream/clip/v2";

				// INITIALIZE EVENT SOURCE
				this.events[config.id] = new EventSource(sseURL, {
					headers: { 'hue-application-key': config.key },
					https: { rejectUnauthorized: false },
				});

				// PIPE MESSAGE TO TARGET FUNCTION
				this.events[config.id].onmessage = (event) => {
					if(event && event.type === 'message' && event.data) {
						const messages: EventUpdate[] = JSON.parse(event.data);
						messages.forEach((msg: EventUpdate) => {
							if (msg.type === "update") {
								callback(msg.data);
							}
						});
					}
				};

				// CONNECTED?
				this.events[config.id].onopen = () => resolve(true);

				// ERROR? -> RETRY?
				this.events[config.id].onerror = (error) => {
					console.log("HueMagic:", "Connection to bridge lost. Trying to reconnect again in 30 seconds…", error);
					setTimeout(() => this.subscribe(config, callback), 30000);
					resolve(true);
				}
			} else {
				this.unsubscribe(config);
				this.subscribe(config, callback);
			}
		});
	}

	//
	// UNSUBSCRIBE
	static unsubscribe(config: ConfigWithId) {
		if (this.events[config.id] instanceof EventSource) { this.events[config.id].close(); }
		delete this.events[config.id];
	}

	//
	// GET FULL/ROOT RESOURCE

	//
	// PROCESS RESOURCES
	static processResources(resources: AnyResource[]): Promise<[ProcessedResources, GroupsOfResources]> {
		// SET CURRENT DATE/TIME
		const currentDateTime = dayjs().format();

		// ACTION!
		return new Promise((resolve, reject) => {
			let resourceList: { [id: ResourceId]: AnyResource } = {};
			let processedResources: ProcessedResources = {};
			let groupsOf: GroupsOfResources = {};

			// CREATE ID BASED OBJECT OF ALL RESOURCES
			resources.reduce((memo: { [id: ResourceId]: AnyResource }, resource) => {
				if(resource.type !== "button") {
					memo[resource.id] = resource;
				}
				return memo;
			}, {});

			// GET FULL RESOURCES OF EACH OBJECT
			resources.forEach((resource) => {
				// GET FULL RESOURCE
				let fullResource = expandResourceLinks(resource, resourceList);

				// ADD CURRENT DATE/TIME
				fullResource.updated = currentDateTime;

				// ALL ALL TYPES BEHIND RESOURCE
				fullResource.types = [ fullResource.type ];

				// RESOURCE HAS SERVICES?
				if ("services" in fullResource) {
					let additionalServiceTypes = Object.keys(fullResource["services"]) as ResourceType[];

					// SET ADDITIONAL TYPES BEHIND RECCOURCE
					fullResource.types = [ ...fullResource.types, ...additionalServiceTypes ];
				}

				// RESOURCE HAS GROUPED SERVICES?
				if ("grouped_services" in fullResource && fullResource.grouped_services) {
					fullResource.grouped_services.forEach((groupedService) => {
						const groupedServiceID = groupedService.rid;
						if (!groupsOf[groupedServiceID]) { groupsOf[groupedServiceID] = []; }
						groupsOf[groupedServiceID].push(fullResource.id);
					});
				}

				// GIVE FULL RESOURCE BACK TO COLLECTION
				processedResources[fullResource.id] = fullResource;
			});

			resolve([ processedResources, groupsOf ]);
		});
	}
}

// EXPORT
export default API;
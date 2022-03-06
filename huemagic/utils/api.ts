import axios, { AxiosRequestConfig } from "axios";
import dayjs from 'dayjs';
import https from 'https';
import EventSource from 'eventsource';
import { Resource, ResourceRef, ResourceId, BasicResourceUnion, ResourceType, EventUpdate, BaseResourceData, BasicServiceResource, BasicResource, ResourceList } from "./resource-types";



type Config = {
	bridge: string;
	key: string;
}
type ConfigWithId = Config & {
	id: string;
}

type InitArgs = { config: Config | null }
type RequestArgs = {
	method: "GET" | "PUT";
	resource: ResourceType | null;
	data: object | string | null;
	config: Config | null;
	version: 1 | 2;
}


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
type ExpandedResource = ExpandedBasicResource | ExpandedBasicServiceResource;

function expandResourceLinks(resource: BasicResourceUnion, allResources: { [id: string]: (BasicResource | BasicServiceResource) }): ExpandedResource {

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
		return { ...resource } as ExpandedBasicResource;
	}

}


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
	static request({ config = null, method = 'GET', resource = null, data = null, version = 2 }: RequestArgs) {
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
					resolve(response.data);
				}
			})
			.catch(function(error) {
				reject(error);
			});
		});
	}

	//
	// SUBSCRIBE TO BRIDGE EVENTS
	static subscribe(config: ConfigWithId, callback: (data: EventUpdate) => void) {
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
						const messages = JSON.parse(event.data);
						for (var i = messages.length - 1; i >= 0; i--)
						{
							const message = messages[i];
							if(message.type === "update")
							{
								callback(message.data);
							}
						}
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
	static processResources(resources:BasicResourceUnion[]) {
		// SET CURRENT DATE/TIME
		const currentDateTime = dayjs().format();

		// ACTION!
		return new Promise((resolve, reject) => {
			let resourceList: { [id: ResourceId]: BasicResourceUnion } = {};
			let processedResources: {
				_groupsOf: { [ groupedServiceId: ResourceId ]: string[] },
				[ id: ResourceId ]: ExpandedBasicResource|ExpandedBasicServiceResource | { [ groupedServiceId: ResourceId ]: string[] }
			} = { _groupsOf: {} };

			// CREATE ID BASED OBJECT OF ALL RESOURCES
			resources.reduce((memo: { [id: ResourceId]: BasicResourceUnion }, resource) => {
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
						if(!processedResources["_groupsOf"][groupedServiceID]) { processedResources["_groupsOf"][groupedServiceID] = []; }
						processedResources["_groupsOf"][groupedServiceID].push(fullResource.id);
					});
				}

				// GIVE FULL RESOURCE BACK TO COLLECTION
				processedResources[fullResource.id] = fullResource;
			});

			resolve(processedResources);
		});
	}
}

// EXPORT
module.exports = new API;
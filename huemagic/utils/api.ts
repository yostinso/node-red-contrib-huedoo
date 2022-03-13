import axios, { AxiosRequestConfig, Method } from "axios";
import https from 'https';
import EventSource from 'eventsource';
import { RealResource, RealResourceType, ResourceId } from "./types/resources/generic";
import { BridgeAutoupdateRequest, BridgeRequest, BridgeV1Response, ConfigRequest, ConfigResponse } from "./types/api/bridge";
import { RulesRequest, RulesV1Response } from "./types/api/rules";
import { AllResourcesRequest, ResourceRequest, ResourceResponse, ResourcesRequest } from "./types/api/resource";
import { ApiRequestV1, ApiRequestV2, ApiResponseData, ApiResponseV1, ApiResponseV2, BridgeConfigWithId } from "./types/api/api";
import { EventUpdateResponse } from "./types/api/event";
import { ExpandedResource } from "./types/expanded/resource";

export type ProcessedResources = { [ id: ResourceId ]: ExpandedResource<RealResourceType> };
export type GroupsOfResources = { [groupedServiceId: ResourceId ]: string[] };
interface ApiRequestV1WithMethod<D> extends ApiRequestV1<D> {
	method: Method
}
interface ApiRequestV2WithMethod<D> extends ApiRequestV2<D> {
	method: Method
}

function makeAxiosRequestV1<R extends ApiResponseV1, D extends ApiRequestV1WithMethod<any>>(req: D, endpoint?: string): Promise<R> {
	let url = `https://${req.config.bridge}/api/${req.config.key}`;
	if (endpoint !== undefined) {
		url += "/" + endpoint;
	}
	let axiosRequest: AxiosRequestConfig = {
		method: req.method,
		url,
		headers: { "Content-Type": "application/json; charset=utf-8" },
		httpsAgent: new https.Agent({ rejectUnauthorized: false }), // Node is somehow not able to parse the official Philips Hue PEM
		data: req.data,
	};
	return axios.request<D, R>(axiosRequest);
}

function makeAxiosRequestV2<T extends ApiResponseData, D = any>(request: ApiRequestV2WithMethod<D>, endpoint: string): Promise<T> {
	let url = `https://${request.config.bridge}/clip/v2/${endpoint}`;
	let data = request.method.toUpperCase() != "GET" ? request.data : undefined;

	let axiosRequest: AxiosRequestConfig = {
		method: request.method,
		url,
		data,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"hue-application-key": request.config.key
		},
		httpsAgent: new https.Agent({ rejectUnauthorized: false }), // Node is somehow not able to parse the official Philips Hue PEM
	};
	return axios.request<D, ApiResponseV2<T>>(axiosRequest).then((response) => {
		if (response.errors) {
			//return Promise.reject(`Error from Hue API: ${response.errors.join(", ")}`);
			throw new Error(`Error from Hue API: ${response.errors.join(", ")}`);
		}
		return response.data;
	});
}

class API {
	// EVENTS
	private static events: {
		[targetId: string]: EventSource
	} = {};

	//
	// INITIALIZE
	static init(config: ConfigRequest): Promise<ConfigResponse> {
		// GET BRIDGE
		if (!config || typeof config.bridge !== "string" || config.bridge.length == 0) {
			return Promise.reject("Bridge is not configured!");
		}

		// GET BRIDGE INFORMATION
		return makeAxiosRequestV1<ConfigResponse, ApiRequestV1WithMethod<any>>(
			{ config: { bridge: config.bridge, key: "config" }, method: "GET", },
			undefined
		);
	}

	//
	// MAKE A REQUEST
	static rules(request: RulesRequest): Promise<RulesV1Response> {
		const req = { ...request, method: "GET" } as const;
		return makeAxiosRequestV1(req, `rules`);
	}
	static config(request: BridgeRequest): Promise<BridgeV1Response> {
		const req = { ...request, method: "GET" } as const;
		return makeAxiosRequestV1(req, `config`);
	}
	static setBridgeUpdate(request: BridgeAutoupdateRequest): Promise<BridgeV1Response> {
		const req = { ...request, method: "PUT" } as const;
		return makeAxiosRequestV1(req, `config`)
	}
	static getAllResources(request: AllResourcesRequest): Promise<ResourceResponse<any>[]> {
		const req = { ...request, method: "GET" } as const;
		return makeAxiosRequestV2(req, "resource");
	}
	static getResources<T extends RealResourceType>(request: ResourcesRequest<T>): Promise<ResourceResponse<T>[]> {
		const req = { ...request, method: "GET" } as const;
		let endpoint = `resource/${request.resource}`;
		return makeAxiosRequestV2(req, endpoint);
	}
	static getResource<R extends RealResourceType, T extends ResourceRequest<R>>(request: T): Promise<ResourceResponse<R>> {
		const req = { ...request, method: "GET" } as const;
		let endpoint = `resource/${request.resource}/${request.data}`;
		return makeAxiosRequestV2(req, endpoint);
	}

	// SUBSCRIBE TO BRIDGE EVENTS
	static subscribe(config: BridgeConfigWithId, callback: (data: EventUpdateResponse<RealResource<any>>[]) => void): Promise<true> {
		return new Promise((resolve) => {
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
						const messages: EventUpdateResponse<any>[] = JSON.parse(event.data);
						messages.forEach((msg: EventUpdateResponse<any>) => {
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
					setTimeout(() => resolve(this.subscribe(config, callback)), 30000);
				}
			} else {
				this.unsubscribe(config);
				resolve(this.subscribe(config, callback));
			}
		});
	}

	//
	// UNSUBSCRIBE
	static unsubscribe(config: BridgeConfigWithId) {
		if (this.events[config.id]) { this.events[config.id].close(); }
		delete this.events[config.id];
	}
}

// EXPORT
export default API;
export { makeAxiosRequestV2 }; // for testing
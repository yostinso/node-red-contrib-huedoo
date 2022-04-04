import dayjs from "dayjs";
import TypedEmitter from "./utils/typed-event-emitter";
import { NextFunction, ParamsDictionary, Query, Request, Response } from "express-serve-static-core";
import { queue as FastQ } from "fastq";
import * as NodeRed from "node-red";
import util from "util";
import NodeRedNode from "./ES6Node";
import API, { ProcessedResources } from './utils/api';
import { isDiff, mergeDeep } from "./utils/merge";
import { Bridge, isBridgeConfigV1ResponseError } from "./utils/types/api/bridge";
import { EventUpdateResponse } from "./utils/types/api/event";
import { ResourceResponse } from "./utils/types/api/resource";
import { Rule } from "./utils/types/api/rules";
import { ExpandedResource, expandedResources, ExpandedServiceOwnerResource, isExpandedServiceOwnerResource } from "./utils/types/expanded/resource";
import { Button, isButton } from "./utils/types/resources/button";
import { isOwnedResource, RealResource, RealResourceType, ResourceId, ResourceType, ServiceOwnerResourceType, serviceOwnerResourceTypes, SpecialResource, SpecialResourceType } from "./utils/types/resources/generic";
import { info } from "console";

export interface HueBridgeDef extends NodeRed.NodeDef {
	autoupdates?: boolean;
	disableupdates?: boolean;
	bridge: string;
	key: string;
}

export interface UpdatedResourceEvent {
	id: ResourceId,
	type: ResourceType,
	updatedType: ResourceType,
	services: ResourceId[],
	suppressMessage: boolean
}

type SubscribedResourceType = "light" | "motion" | "temperature" | "light_level" | "button" | "group" | "rule" | "bridge";
interface SubscribedResourceEvent extends UpdatedResourceEvent {
	updatedType: SubscribedResourceType
}
type SubscribedResourceCallbackMessage<T extends SubscribedResourceType> = T extends "bridge" ? UpdatedResourceEvent : SubscribedResourceEvent;
type SubscribedResourceCallback<T extends SubscribedResourceType> = (event: SubscribedResourceCallbackMessage<T>) => void;
const messageWhitelist = {
	"light": ["light", "zigbee_connectivity", "zgp_connectivity", "device"],
	"motion": ["motion", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
	"temperature": ["temperature", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
	"light_level": ["light_level", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
	"button": ["button", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
	"group": ["group", "light", "grouped_light"],
	"rule": ["rule"],
	"bridge": []
};
function isWhitelistedType(eventType: SubscribedResourceType, event: UpdatedResourceEvent): event is SubscribedResourceEvent {
	const types = messageWhitelist[eventType] as ResourceType[];
	return types.includes(event.updatedType);
}

type Req = Request<ParamsDictionary, any, any, Query, Record<string, any>>;
type Res = Response<any, Record<string, any>>

interface Patch {
	type: string;
	id: string;
	patch: object;
	version: number;
}

export class HueBridgeConfig extends NodeRedNode {
    private readonly config: HueBridgeDef;
	private readonly RED: NodeRed.NodeAPI;
	public enabled: boolean = true;
	private _resources: ProcessedResources = {};
	public get resources() { return this._resources; } // should be sealed, but isn't for testability
	private _groupsOfResources: { [ groupedServiceId: ResourceId ]: ResourceId[] } = {};
	public get groupsOfResources() { return this._groupsOfResources; } // should be sealed, but isn't for testability
	private lastStates: { [typeAndId: string]: RealResource<RealResourceType> } = {};
	private readonly _events: TypedEmitter<string, UpdatedResourceEvent>;
	public get events() { return this._events; }
	private patchQueue?: FastQ<Patch>;
	private _firmwareUpdateTimeout?: NodeJS.Timeout;
	public get firmwareUpdateTimeout() { return this._firmwareUpdateTimeout; }

	// RESOURCE ID PATTERN
	static readonly validResourceID = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;

    constructor(node: NodeRed.Node, config: HueBridgeDef, RED: NodeRed.NodeAPI) {
		super(node); // become a Node!
        this.config = config;
		this._events = new TypedEmitter();
		this.RED = RED;

		//this.init();
	}

	init() {
		this.on("close", this.shutdown);
		this.start();
		this.registerNodeRedEndpoints();
		//this.createPatchQueue();
	}

	registerNodeRedEndpoints() {
		//RequestHandlerParams<P, ResBody, ReqBody, ReqQuery, Locals>
		this.RED.httpAdmin.get("/hue/bridges", this.getBridges);
		this.RED.httpAdmin.get("/hue/name", this.getBridgeName);
		this.RED.httpAdmin.get("/hue/register", this.registerWithBridge);
		this.RED.httpAdmin.get("/hue/resources", this.getResources);
	}
	getBridges(req: Req, res: Res, next: NextFunction): void {
		throw new Error("Not implemented");
	}
	getBridgeName(req: Req, res: Res, next: NextFunction): void {
		throw new Error("Not implemented");
	}
	registerWithBridge(req: Req, res: Res, next: NextFunction): void {
		throw new Error("Not implemented");
	}
	getResources(req: Req, res: Res, next: NextFunction): void {
		throw new Error("Not implemented");
	}

	shutdown() {
		this.log("Shutting down...");
		this.enabled = false;
		this.log("  Unsubscribing from bridge events...");
		API.unsubscribe(this.config);
		
		this.log("  Unregistering listeners...");
		this._events.removeAllListeners();
		
		if (this.firmwareUpdateTimeout) { clearTimeout(this.firmwareUpdateTimeout); }

		// TODO
		// this.patchQueue.kill();
	}

	start(): Promise<boolean> {
		this.log("Initializing the bridge (" + this.config.bridge + ")…");
		return API.init(this.config)
		.then(() => {
			this.log("Connected to bridge");
			return this.getAllResources();
		})
		.then((allResources) => {
			this.log("Processing bridge resources…");
			return expandedResources(allResources);
		})
		.then(([ allResources, groupsOfResources ]) => {
			// SAVE CURRENT RESOURCES
			this._resources = allResources;
			this._groupsOfResources = groupsOfResources;

			// EMIT INITIAL STATES -> NODES
			this.log("Initial emit of resource states…");
			return this.emitInitialStates();
		})
		.then(() => {
			// START REFRESHING STATES
			this.keepUpdated();

			// START LOOKING FOR FIRMWARE-UPDATES
			this.autoUpdateFirmware();
			return true;
		})
		.catch((error) => {
			return new Promise((resolve) => {
				// RETRY AFTER 30 SECONDS
				this.log(error);
				if (this.enabled) {
					setTimeout(() => {
						resolve(this.start());
					}, 30000);
				} else {
					resolve(false);
				}
			});
		});
	}

	getAllResources(): Promise<RealResource<any>[]> {
		return new Promise((resolve, reject) => {
			let allResources: RealResource<any>[] = [];

			// GET BRIDGE INFORMATION
			this.getBridgeInformation().then((bridge) => {
				// INITIALIZE RESOURCES LIST
				allResources.push(bridge);
				// CONTINUE WITH ALL RESOURCES
				return API.getAllResources({
					config: this.config,
				});
			}).then((v2Resources) => {
				// MERGE devices/lights/etc TO RESOURCES
				allResources.push(...v2Resources);

				// GET RULES (LEGACY API)
				return API.rules({
					config: this.config,
				});
			}).then((rulesResponse) => {
				// MERGE rules TO RESOURCES
				let rules = Object.entries(rulesResponse).map(([id, rule]) => {
					let newRule: Rule = {
						...rule,
						_owner: rule.owner,
						id: `rule_${id}`,
						id_v1: `/rules/${id}`,
						type: "rule",
					};
					return newRule;
				})
				allResources.push(...rules);

				resolve(allResources);
			})
			.catch((error) => { reject(error); });
		});
	}

	getBridgeInformation(replaceResources = false): Promise<Bridge> {
		return new Promise((resolve, reject) => {
			API.config({
				config: this.config,
			}).then((bridgeInformation) => {
				const b: Bridge = {
					...bridgeInformation,
					type: "bridge",
					id: "bridge",
					id_v1: "/config",
					updated: dayjs().format(),
				}
				if (replaceResources) {
					this._resources[b.id] = b;
				}
				resolve(b);
			}).catch((error) => reject(error));
		});
	}

	// EMIT INITIAL STATES -> NODES
	emitInitialStates() {
		return new Promise((resolve, reject) => {
			// PUSH STATES
			setImmediate(() => {
				// PUSH ALL STATES
				Object.entries(this.resources).forEach(([id, resource]) => {
					this.pushUpdatedState(resource, resource.type, true);
				});

				resolve(true);
			});
		});
	}

	keepUpdated() {
		if(!this.config.disableupdates)
		{
			this.log("Keeping nodes up-to-date…");

			// REFRESH STATES (SSE)
			this.subscribeToBridgeEventStream();
		}
	}

	private getPreviousResourceState<T extends RealResourceType>(resource: ExpandedResource<T>): ExpandedResource<T> | undefined {
		let previousState: ExpandedResource<T> | undefined = undefined;

		/* The resource state can be stored in one of two places:
		 * Directly in this.resources[resource.id] <--- there will always be an entry here
		 * Inside a "parent" resource like a group in this.resources[resource.owner.rid][resource.type][resource.id]
		 *
		 * We use the latter preferentially if it exists, but they should be in sync.
		 */
		let parentResource = this.getParentResource(resource);
		if (parentResource?.services?.[resource.type]?.[resource.id]) {
			previousState = parentResource!.services![resource.type]![resource.id] as ExpandedResource<T>;
		} else {
			previousState = this._resources[resource.id] as ExpandedResource<T>;
		}
		
		return previousState;
	}

	getParentResource(resource: ResourceResponse<RealResourceType>): ExpandedServiceOwnerResource<ServiceOwnerResourceType> | undefined {
		if (isOwnedResource(resource) && resource.owner) {
			let owner = this._resources[resource.owner.rid];
			if (!owner) { throw new Error(`No resource entry for ${resource.owner.rid} even though there is an owner reference on resource ${resource.id}`); }
			if (isExpandedServiceOwnerResource(owner)) {
				return owner;
			} else {
				console.warn(`Owner ${owner.id} is not an expected owner type (${serviceOwnerResourceTypes.join(", ")})... got ${owner.type}.`);
				return owner as ExpandedServiceOwnerResource<ServiceOwnerResourceType>;
			}
		} else {
			return undefined;
		}
	}

	handleBridgeEvent(updates: EventUpdateResponse<RealResource<any>>[]): void {
			const currentDateTime = dayjs().format();

			updates.forEach((event) => {
				let resource: ResourceResponse<RealResourceType> = event.data;
				let previousState = this.getPreviousResourceState(resource);
				// NO PREVIOUS STATE?
				// TODO: Handle ADD / DELETE events
				if (previousState === undefined) { return; }

				const mergedState = mergeDeep(previousState, resource);

				if (isDiff(previousState, mergedState)) {
					// Update our cached resource
					this._resources[resource.id] = mergedState;
					this._resources[resource.id].updated = currentDateTime;

					// We should also update the expanded reference to this resource
					let parentResource = this.getParentResource(resource);
					if (parentResource?.services?.[resource.type]?.[resource.id]) {

						if (isButton(resource) && parentResource.services.button) {
							// Special case for Buttons... Remove the .button from all button references in the parent
							// since they are part of a single device (like a Hue dimmer switch), and we only want to
							// hear about the most recent event
							Object.keys(parentResource.services.button).forEach((btnId) => {
								delete (parentResource!.services!.button![btnId] as Button).button
							})
						}

						/* We have to do a typecast here because we are narrowing to a _specific_
						 * type and I don't want a type assertion for every possible device type
						 */
						(parentResource.services![resource.type]![resource.id] as ExpandedResource<RealResourceType>) = {
							...mergedState,
							updated: currentDateTime
						};
						// Notify on the parent, not the child
						this.pushUpdatedState(this._resources[parentResource.id], resource.type);
					} else {
						// If we don't have a parent to notify on, notify directly
						this.pushUpdatedState(this._resources[resource.id], resource.type);
					}
				}
			});

	}

	subscribeToBridgeEventStream() {
		this.log("Subscribing to bridge events…");
		API.subscribe(this.config, this.handleBridgeEvent);
	}

	autoUpdateFirmware(): Promise<boolean> {
		if (this.config.autoupdates === true || this.config.autoupdates === undefined) {
			if (this._firmwareUpdateTimeout !== undefined) { clearTimeout(this._firmwareUpdateTimeout); }

			return API.setBridgeUpdate({
				config: this.config,
				data: {
					swupdate2: {
						checkforupdate: true,
						install: true
					}
				}
			}).then(() => {
				// SUCCESS // TRY AGAIN IN 12H
				if (this.enabled) {
					this._firmwareUpdateTimeout = setTimeout(() => this.autoUpdateFirmware(), 60000 * 720);
				}
				return true;
			})
			.catch((error) => {
				this.warn("Error response updating checkforupdate / autoinstall");
				if (Array.isArray(error)) {
					this.warn(
						error.filter(isBridgeConfigV1ResponseError).map((e) => e.error.description).join("\n")
					);
				}
				if (this.enabled) {
					return new Promise((resolve) => {
						this._firmwareUpdateTimeout = setTimeout(() => resolve(this.autoUpdateFirmware()), 5000);
					})
				} else {
					return Promise.resolve(false);
				}
				// NO UPDATES AVAILABLE // TRY AGAIN IN 12H
			});
		}
		return Promise.resolve(false);
	}

	pushUpdatedState(resource: ExpandedResource<RealResourceType> | SpecialResource<SpecialResourceType>, updatedType: ResourceType, suppressMessage: boolean = false): void {
		let serviceIds: ResourceId[] = [];
		if (isExpandedServiceOwnerResource(resource) && resource.services) {
			serviceIds = Object.values(resource.services).map((h) => Object.keys(h)).flat();
		}
		
		const msg: UpdatedResourceEvent = {
			id: resource.id,
			type: resource.type,
			updatedType: updatedType,
			services: serviceIds,
			suppressMessage: suppressMessage
		};
		this._events.emit(this.config.id + "_" + resource.id, msg);
		this._events.emit(this.config.id + "_" + "globalResourceUpdates", msg);

		// RESOURCE CONTAINS SERVICES? -> SERVICE IN GROUP? -> EMIT CHANGES TO GROUPS ALSO
		if(this._groupsOfResources[resource.id]) {
			for (var g = this._groupsOfResources[resource.id].length - 1; g >= 0; g--) {
				const groupID = this._groupsOfResources[resource.id][g];
				const groupMessage: UpdatedResourceEvent = {
					id: groupID,
					type: "group",
					updatedType: updatedType,
					services: [],
					suppressMessage: suppressMessage
				};

				this._events.emit(this.config.id + "_" + groupID, groupMessage);
				this._events.emit(this.config.id + "_" + "globalResourceUpdates", groupMessage);
			}
		}
	}
	
	subscribe<T extends SubscribedResourceType>(type: T, callback: SubscribedResourceCallback<T>): void;
	subscribe<T extends SubscribedResourceType>(type: T, id: string, callback: SubscribedResourceCallback<T>): void;
	subscribe<T extends SubscribedResourceType>(type: T, idOrCallback: ResourceId|SubscribedResourceCallback<T>, callbackOrUndefined?: SubscribedResourceCallback<T>): void {
		const callback = callbackOrUndefined || (idOrCallback as SubscribedResourceCallback<T>);
		let id = callbackOrUndefined ? idOrCallback : undefined;

		if (id === undefined) {
			this._events.on(`${this.config.id}_globalResourceUpdates`, (resourceEvent: UpdatedResourceEvent) => {
				if (type == "bridge") {
					(callback as SubscribedResourceCallback<"bridge">)(resourceEvent);
				} else if (type == "rule" && isWhitelistedType(type, resourceEvent)) {
					callback(resourceEvent);
				} else if (resourceEvent.services.includes(type) && isWhitelistedType(type, resourceEvent)) {
					callback(resourceEvent);
				}
			});
		} else {
			if (type == "rule") { id = `rule_${id}`; }
		}
	}

	/*
	get(type: ResourceType, id: ResourceId | false = false, options = {}) {
		if (id) {
			// GET RESOURCE BY ID
			if (!this.resources[id]) { return false; }
			const targetResource: ExpandedResource<RealResourceType> | SpecialResource<SpecialResourceType> = this.resources[id];
			const targetId = targetResource.id;
			const lastState = this.lastStates[type+targetResource.id] ? Object.assign({}, this.lastStates[type+targetResource.id]) : false;

			let message;
			switch (targetResource.type) {
				case "bridge":
					message = new HueBridgeMessage(targetResource, options);
					return message.msg;
				case "light":
					message = new HueLightMessage(targetResource, options);
					break;
				case "group":
					// GET MESSAGE
					message = new HueGroupMessage(targetResource, { resources: this.resources, ...options});
					break;
				case "button":
					message = new HueButtonsMessage(targetResource, options);
					break;
				case "motion":
					message = new HueMotionMessage(targetResource, options);
					break;
				case "temperature":
					message = new HueTemperatureMessage(targetResource, options);
					break;
				case "light_level":
					message = new HueBrightnessMessage(targetResource, options);
					break;
				case "rule":
					message = new HueRulesMessage(targetResource, options);
					break;
				default:
					return false;
			}

			// GET & SAVE LAST STATE AND DIFFERENCES
			const currentState = message.msg;
			this.lastStates[`${type}${targetId}`] = { ...currentState };
			currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
			currentState.lastState = lastState;
			return currentState;
		} else {
			// GET RESOURCES BY TYPE
			let allFilteredResources = {};

			for (const [rootID, resource] of Object.entries(scope.resources))
			{
				const isGroup = (resource["type"] == "room" || resource["type"] == "zone" || resource["type"] == "bridge_home");

				// NORMAL DEVICES
				if(!isGroup && resource["services"] && resource["services"][type])
				{
					for (const [serviceID, targetDevice] of Object.entries(resource["services"][type]))
					{
						allFilteredResources[rootID] = scope.get(type, rootID);
					}
				}
				// GROUPED RESOURCES
				else if(isGroup && type === "group")
				{
					allFilteredResources[rootID] = scope.get(type, rootID);
				}
			}

			return Object.values(allFilteredResources);
		}
	}
	*/
}

		/*
module.exports = (RED: NodeRed.NodeAPI) {
	function HueBridge(config: HueBridgeDef)
	{
		// CREATE NODE
		RED.nodes.createNode(scope, config);

		// GET ALL RESOURCES + RULES


		// GET UPDATED STATES (SSE)

		// PUSH UPDATED STATE

		// GET RESOURCE (FROM NODES)

		// PATCH RESOURCE (FROM NODES)
		this.patch = function(type, id, patch, version = 2)
		{
			return new Promise(function(resolve, reject)
			{
				if(!scope.patchQueue) { return false; }
				scope.patchQueue.push({ type: type, id: id, patch: patch, version: version }, function (error, response)
				{
					if(error)
					{
						reject(error);
					}
					else
					{
						resolve(response);
					}
				});
			});
		}

		// PATCH RESOURCE (WORKER) / 7 PROCESSES IN PARALLEL
		this.patchQueue = fastq(function({ type, id, patch, version }, callback)
		{
			// GET SERVICE ID
			if(version !== 1 && scope.resources[id] && scope.resources[id]["services"] && scope.resources[id]["services"][type])
			{
				const targetResource = Object.values(scope.resources[id]["services"][type])[0];
				id = targetResource.id;
			}

			// ACTION!
			API.request({ config: config, method: "PUT", resource: (version === 2) ? (type+"/"+id) : id, data: patch, version: version })
			.then(function(response) {
				callback(null, response);
			})
			.catch(function(error) {
			console.log("yep error: ", id, patch);
				callback(error, null);
			});
		}, config.worker ? parseInt(config.worker) : 10);

		// RE-FETCH RULE (RECEIVES NO UPDATES VIA SSE)
		this.refetchRule = function(id)
		{
			return new Promise(function(resolve, reject)
			{
				API.request({ config: config, resource: "/rules/" + id, version: 1 })
				.then(function(rule)
				{
					// "RENAME" OWNER
					rule["_owner"] = rule["owner"];
					delete rule["owner"];

					// ADD RULE ID(S)
					rule["id"] = "rule_" + id;
					rule["id_v1"] = "/rules/" + id;

					// ADD RULE TYPE
					rule["type"] = "rule";

					// UPDATED TIME
					rule["updated"] = dayjs().format();

					// ADD BACK TO RESOURCES
					scope.resources[rule["id"]] = rule;

					// PUSH UPDATED STATE
					scope.pushUpdatedState(rule, "rule");
					resolve(resolve);
				})
				.catch(function(error) {
					reject(error);
				});
			});
		}

		// SUBSCRIBE (FROM NODES)
		this.subscribe = function(type, id = null, callback = null)
		{
			// IS RULE?
			if(type == "rule" && !!id)
			{
				id = "rule_" + id;
			}

			// PUSH WHITELIST
			const messageWhitelist = {
				"light": ["light", "zigbee_connectivity", "zgp_connectivity", "device"],
				"motion": ["motion", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"temperature": ["temperature", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"light_level": ["light_level", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"button": ["button", "zigbee_connectivity", "zgp_connectivity", "device_power", "device"],
				"group": ["group", "light", "grouped_light"],
				"rule": ["rule"]
			};

			if(!id)
			{
				// UNIVERSAL MODE
				this.events.on(config.id + "_" + "globalResourceUpdates", function(info)
				{
					if(type === "bridge")
					{
						callback(info);
					}
					else if(info.services.includes(type) && messageWhitelist[type].includes(info.updatedType))
					{
						callback(info);
					}
					else if(type == "rule" && messageWhitelist[type].includes(info.updatedType))
					{
						callback(info);
					}
				});
			}
			else
			{
				// SPECIFIC RESOURCE MODE
				this.events.on(config.id + "_" + id, function(info)
				{
					if(type === "bridge" || messageWhitelist[type].includes(info.updatedType))
					{
						callback(info);
					}
				});
			}
		}

		//
		// START THE MAGIC
		this.start();

		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			scope.nodeActive = false;

			// UNSUBSCRIBE FROM BRIDGE EVENTS
			scope.log("Unsubscribing from bridge events…");
			API.unsubscribe(config);

			// UNSUBSCRIBE FROM "READY" EVENTS
			scope.events.removeAllListeners();

			// REMOVE FIRMWARE UPDATE TIMEOUT
			if(scope.firmwareUpdateTimeout !== null) { clearTimeout(scope.firmwareUpdateTimeout); }

			// KILL QUEUE
			scope.patchQueue.kill();
		});
	}
	
	RED.nodes.registerType("hue-bridge", HueBridge);

	//
	// DISCOVER HUE BRIDGES ON LOCAL NETWORK
	RED.httpAdmin.get('/hue/bridges', async function(req, res, next)
	{
		axios.request({
			"method": "GET",
			"url": "https://discovery.meethue.com",
			"headers": {
				"Content-Type": "application/json; charset=utf-8"
			},
		})
		.then(function(response)
		{
			// PREPARE BRIDGES OUTPUT
			var bridges = {};
			for (var i = response.data.length - 1; i >= 0; i--)
			{
				var ipAddress = response.data[i].internalipaddress;
				bridges[ipAddress] = { ip: ipAddress, name: ipAddress };
			}

			res.end(JSON.stringify(Object.values(bridges)));
		})
		.catch(function(error) {
			res.send(error);
		});
	});

	//
	// GET BRIDGE NAME
	RED.httpAdmin.get('/hue/name', function(req, res, next)
	{
		if(!req.query.ip)
		{
			return res.status(500).send(RED._("hue-bridge-config.config.missing-ip"));
	    }
	    else
	    {
			API.init({ config: { bridge: req.query.ip, key: "huemagic" } })
			.then(function(bridge) {
				res.end(bridge.name);
			})
			.catch(function(error) {
				res.send(error);
			});
	    }
	});

	//
	// REGISTER A HUE BRIDGE
	RED.httpAdmin.get('/hue/register', function(req, rescope, next)
	{
		if(!req.query.ip)
		{
			return rescope.status(500).send(RED._("hue-bridge-config.config.missing-ip"));
		}
		else
		{
			axios.request({
				"method": "POST",
				"url": "http://"+req.query.ip+"/api",
				"httpsAgent": new https.Agent({ rejectUnauthorized: false }),
				"headers": {
					"Content-Type": "application/json; charset=utf-8"
				},
				"data": {
					"devicetype": "HueMagic for Node-RED (" + Math.floor((Math.random() * 100) + 1) + ")"
				}
			})
			.then(function(response)
			{
				var bridge = response.data;
				if(bridge[0].error)
				{
					rescope.end("error");
				}
				else
				{
					rescope.end(JSON.stringify(bridge));
				}
			})
			.catch(function(error) {
				rescope.status(500).send(error);
			});
		}
	});

	//
	// DISCOVER RESOURCES
	RED.httpAdmin.get('/hue/resources', function(req, res, next)
	{
		const targetType = req.query.type;

		// GET ALL RULES
		if(targetType == "rule")
		{
			API.request({ config: { bridge: req.query.bridge, key: req.query.key }, resource: "/rules", version: 1 })
			.then(function(rules)
			{
				let targetRules = {};

				for (var [id, rule] of Object.entries(rules))
				{
					var oneDevice = {};
					oneDevice.id = id;
					oneDevice.name = rule.name;
					oneDevice.model = false;

					targetRules[id] = oneDevice;
				}

				// CONVERT TO ARRAY
				targetRules = Object.values(targetRules);

				// GIVE BACK
				res.end(JSON.stringify(targetRules));
			})
			.catch(function(error) {
				res.status(500).send(JSON.stringify(error));
			});
		}
		// GET ALL OTHER RESOURCES
		else
		{
			API.request({ config: { bridge: req.query.bridge, key: req.query.key }, resource: "all" })
			.then((allResources) => {
				return API.processResources(allResources);
			}).then((processedResources) => {
				let targetDevices = {};

				for (const [id, resource] of Object.entries(processedResources))
				{
					const isGroup = (resource["type"] == "room" || resource["type"] == "zone" || resource["type"] == "bridge_home");

					// NORMAL DEVICES
					if(!isGroup && resource["services"] && resource["services"][targetType])
					{
						for (const [deviceID, targetDevice] of Object.entries(resource["services"][targetType]))
						{
							var oneDevice = {};
							oneDevice.id = id;
							oneDevice.name = resource.metadata ? resource.metadata.name : false;
							oneDevice.model = resource.product_data ? resource.product_data.product_name : false;

							targetDevices[id] = oneDevice;
						}
					}
					// GROUPED (LIGHT) RESOURCES
					else if(isGroup && targetType === "group")
					{
						if(resource["services"] && resource["services"]["grouped_light"])
						{
							var oneDevice = {};
							oneDevice.id = id;
							oneDevice.name = resource.metadata ? resource.metadata.name : false;
							oneDevice.model = resource["type"];

							targetDevices[id] = oneDevice;
						}
					}
					// SCENES
					else if(targetType === "scene" && resource["type"] == "scene")
					{
						var oneDevice = {};
						oneDevice.id = id;
						oneDevice.name = resource.metadata ? resource.metadata.name : false;
						oneDevice.group = processedResources[resource["group"]["rid"]].metadata.name;

						targetDevices[id] = oneDevice;
					}
				}

				// CONVERT TO ARRAY
				targetDevices = Object.values(targetDevices);

				// GIVE BACK
				res.end(JSON.stringify(targetDevices));
			})
			.catch((error) => {
				res.status(500).send(JSON.stringify(error));
			});
		}
	});
};
	*/

module.exports = function (RED: NodeRed.NodeAPI) {
    function MakeNode2(this: NodeRed.Node, config: HueBridgeDef) {
        RED.nodes.createNode(this, config);
        util.inherits(HueBridgeConfig, this.constructor);
        return new HueBridgeConfig(this, config, RED);
    }
	RED.nodes.registerType(
		"huedoo-bridge-config",
		MakeNode2
	)
}

export default module.exports;
module.exports.HueBridgeConfig = HueBridgeConfig;

import axios from "axios";
import dayjs from "dayjs";
import { diff } from "deep-object-diff";
import EventEmitter from "events";
import fastq from "fastq";
import https from "https";
import * as NodeRed from "node-red";
import API, { ProcessedResources } from './utils/api';
import { isDiff, mergeDeep } from "./utils/merge";
import {
	HueBridgeMessage, HueBrightnessMessage,
	HueButtonsMessage, HueGroupMessage, HueLightMessage, HueMotionMessage, HueRulesMessage, HueTemperatureMessage
} from "./utils/messages";
import { Bridge } from "./utils/types/api/bridge";
import { Resource, ResourceResponse } from "./utils/types/api/resource";
import { Rule } from "./utils/types/api/rules";
import { ExpandedOwnedServices, ExpandedResource, expandedResources, ExpandedServiceOwnerResourceResponse } from "./utils/types/expanded/resource";
import { isOwnedResource, OwnedResource, OwnedResourceType, RealResource, RealResourceType, ResourceId, ServiceOwnerResourceType } from "./utils/types/resources/generic";

interface HueBridgeDef extends NodeRed.NodeDef {
	autoupdates?: boolean;
	disableupdates?: boolean;
	bridge: string;
	key: string;
}

class HueBridge {
    private readonly node: NodeRed.Node; 
    private readonly config: HueBridgeDef;
	private nodeActive: boolean = true;
	private resources: ProcessedResources = {};
	private groupsOfResources: { [ groupedServiceId: ResourceId ]: ResourceId[] } = {};
	private lastStates: object = {};
	private readonly events: EventEmitter;
	private patchQueue: object = {};
	private firmwareUpdateTimeout?: NodeJS.Timeout;

	// RESOURCE ID PATTERN
	static readonly validResourceID = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;

    constructor(RED: NodeRed.NodeAPI, node: NodeRed.Node, config: HueBridgeDef) {
        RED.nodes.createNode(node, config);
        this.node = node;
        this.config = config;
		this.events = new EventEmitter();
	}

	start() {
		this.node.log("Initializing the bridge (" + this.config.bridge + ")…");
		API.init({ config: this.config })
		.then(() => {
			this.node.log("Connected to bridge");
			return this.getAllResources();
		})
		.then((allResources) => {
			this.node.log("Processing bridge resources…");
			return expandedResources(allResources);
		})
		.then(([ allResources, groupsOfResources ]) => {
			// SAVE CURRENT RESOURCES
			this.resources = allResources;
			this.groupsOfResources = groupsOfResources;

			// EMIT INITIAL STATES -> NODES
			this.node.log("Initial emit of resource states…");
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
			// RETRY AFTER 30 SECONDS
			this.node.log(error);
			if (this.nodeActive == true) { setTimeout(() => { this.start(); }, 30000); }
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
					version: 2,
					method: "GET",
					config: this.config,
				});
			}).then((v2Resources) => {
				// MERGE devices/lights/etc TO RESOURCES
				allResources.push(...v2Resources);

				// GET RULES (LEGACY API)
				return API.rules({
					version: 1,
					method: "GET",
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
				method: "GET",
				version: 1,
			}).then((bridgeInformation) => {
				const b: Bridge = {
					...bridgeInformation,
					type: "bridge",
					id: "bridge",
					id_v1: "/config",
					updated: dayjs().format(),
				}
				if (replaceResources) {
					this.resources[b.id] = b;
				}
				resolve(b);
			}).catch((error) => reject(error));
		});
	}

	// EMIT INITIAL STATES -> NODES
	emitInitialStates() {
		return new Promise((resolve, reject) => {
			// PUSH STATES
			setTimeout(() => {
				// PUSH ALL STATES
				Object.entries(this.resources).forEach(([id, resource]) => {
					this.pushUpdatedState(resource, resource.type, true);
				});

				resolve(true);
			}, 500);
		});
	}

	keepUpdated() {
		if(!this.config.disableupdates)
		{
			this.node.log("Keeping nodes up-to-date…");

			// REFRESH STATES (SSE)
			this.refreshStatesSSE();
		}
	}

	private getCachedServices<T extends OwnedResource<OwnedResourceType>>(resource: T): ExpandedOwnedServices {
		if (isOwnedResource(resource)) {
			let r = resource as OwnedResource<OwnedResourceType>;
			if (r.owner) {
				let cachedOwner: ExpandedServiceOwnerResourceResponse<ServiceOwnerResourceType> = this.resources[r.owner.rid];
				if (cachedOwner.services) {
					return cachedOwner.services;
				}
			}
		}
		return {};
	}

	private getPreviousResourceState<T extends RealResourceType>(resource: ExpandedResource<T>): ExpandedResource<T> | undefined {
		let previousState: ExpandedResource<T> | undefined = undefined;
		let ownerServices = this.getCachedServices(resource);
		if (ownerServices[resource.type]?.[resource.id] !== undefined) {
			previousState = ownerServices![resource.type]![resource.id];
			if ((resource as OwnedResource<OwnedResourceType>).type == "button" && ownerServices.button !== undefined) {
				// IS BUTTON? -> REMOVE PREVIOUS STATES
				for (let key in ownerServices.button) {
					delete ownerServices.button[key]
				}
			}
		} else if (this.resources[resource.id]) {
			previousState = this.resources[resource.id] as ExpandedResource<T>;
		}
		return previousState;
	}

	refreshStatesSSE() {
		this.node.log("Subscribing to bridge events…");
		API.subscribe(this.config, (updates) => {
			const currentDateTime = dayjs().format();

			updates.forEach((event) => {
				let resource: ResourceResponse<RealResourceType> = event.data;
				let previousState = this.getPreviousResourceState(resource);
				// NO PREVIOUS STATE?
				if (previousState === undefined) { return false; }

				// CHECK DIFFERENCES
				const mergedState = mergeDeep(previousState, resource);

				if (isDiff(previousState, mergedState)) {
					if (isOwnedResource(resource)) {
						let ownerServices = this.getCachedServices(resource);
						if (ownerServices[resource.type] !== undefined) {
							let ownedResources = (ownerServices[resource.type] || {});
							(ownedResources[resource.id] as ExpandedResource<RealResourceType>) = mergedState;
							this.resources[resource.id].updated = currentDateTime;
						}

						// PUSH STATE
						this.pushUpdatedState(this.resources[resource.id], resource.type);
					} else {
						this.resources[resource.id] = mergedState;
						this.resources[resource.id].updated = currentDateTime;

						// PUSH STATE
						this.pushUpdatedState(this.resources[resource.id], resource.type);
					}
				}
			});
		});
	}

	autoUpdateFirmware() {
		if (this.config.autoupdates === true || this.config.autoupdates === undefined) {
			if (this.firmwareUpdateTimeout !== undefined) { clearTimeout(this.firmwareUpdateTimeout); }

			API.request({
				config: this.config,
				method: "PUT",
				resource: "/config",
				version: 1,
				data: {
					swupdate2: {
						checkforupdate: true,
						install: true
					}
				}
			})
			.then((status) => {
				if(this.nodeActive == true) {
					this.firmwareUpdateTimeout = setTimeout(() => this.autoUpdateFirmware(), 60000 * 720);
				}
			})
			.catch((error) => {
				// NO UPDATES AVAILABLE // TRY AGAIN IN 12H
				if(this.nodeActive == true) {
					this.firmwareUpdateTimeout = setTimeout(() => this.autoUpdateFirmware(), 60000 * 720);
				}
			});
		}
	}

	pushUpdatedState(resource: ExpandedResource, updatedType: ResourceType, suppressMessage: boolean = false): void {
		const msg = { id: resource.id, type: resource.type, updatedType: updatedType, services: resource["services"] ? Object.keys(resource["services"]) : [], suppressMessage: suppressMessage };
		this.events.emit(this.config.id + "_" + resource.id, msg);
		this.events.emit(this.config.id + "_" + "globalResourceUpdates", msg);

		// RESOURCE CONTAINS SERVICES? -> SERVICE IN GROUP? -> EMIT CHANGES TO GROUPS ALSO
		if(this.groupsOfResources[resource.id])
		{
			for (var g = this.groupsOfResources[resource.id].length - 1; g >= 0; g--)
			{
				const groupID = this.groupsOfResources[resource.id][g];
				const groupMessage = { id: groupID, type: "group", updatedType: updatedType, services: [], suppressMessage: suppressMessage };

				this.events.emit(this.config.id + "_" + groupID, groupMessage);
				this.events.emit(this.config.id + "_" + "globalResourceUpdates", groupMessage);
			}
		}
	}

	get(type: ResourceType, id: ResourceId | false = false, options = {}) {
		if (id) {
			// GET RESOURCE BY ID
			if (!this.resources[id]) { return false; }
			const targetResource: ExpandedResource = this.resources[id];
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
}

module.exports = function(RED) {
	function HueBridge(config)
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

module.exports = function (RED: NodeRed.NodeAPI) {
    RED.nodes.registerType(
        "hue-bridge",
        function(this: NodeRed.Node, config: HueBridgeDef) {
            RED.nodes.createNode(this, config);
			new HueBridge(RED, this, config);
        }
    );
}

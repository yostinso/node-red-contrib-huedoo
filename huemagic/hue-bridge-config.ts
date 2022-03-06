import EventEmitter from "events";
import * as NodeRed from "node-red";

import API, { AnyResource, AnyResponse, ExpandedResource, RulesRequestArgs } from './utils/api';
import merge from "./utils/merge";
const events = require('events');
const dayjs = require('dayjs');
const diff = require("deep-object-diff").diff;
const axios = require('axios');
const https = require('https');
const fastq = require('fastq');

import {
	HueBridgeMessage,
	HueLightMessage,
	HueGroupMessage,
	HueMotionMessage,
	HueTemperatureMessage,
	HueBrightnessMessage,
	HueButtonsMessage,
	HueRulesMessage,
	TypedRulesV1ResponseItem,
	TypedBridgeV1Response,
} from "./utils/messages";
import { BasicResourceUnion } from "./utils/resource-types";
import { BridgeV1Response, RulesV1Response } from "./utils/api";

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
	private resources: { [ id: string ]: ExpandedResource } = {};
	private resourcesInGroups: object = {};
	private lastStates: object = {};
	private readonly events: EventEmitter;
	private patchQueue: object = {};
	private firmwareUpdateTimeout?: number;

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
			return API.processResources(allResources);
		})
		.then((allResources) => {
			// SAVE CURRENT RESOURCES
			this.resources = allResources;

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

	getAllResources(): Promise<AnyResource[]> {
		return new Promise((resolve, reject) => {
			let allResources: AnyResource[] = [];

			// GET BRIDGE INFORMATION
			this.getBridgeInformation().then((bridgeInformation) => {
				// PUSH TO RESOURCES
				allResources.push({
					...bridgeInformation,
					type: "bridge",
					id: bridgeInformation.bridgeid,
					id_v1: "/config"
				});

				// CONTINUE WITH ALL RESOURCES
				return API.request({ config: this.config, resource: "all" });
			}).then((v2Resources) => {
				// MERGE RESOURCES
				allResources.push(...v2Resources);

				// GET RULES (LEGACY API)
				return API.request({ config: this.config, resource: "/rules", version: 1 });
			}).then((rules) => {
				allResources.push(
					...Object.entries(rules).map(([ id, rule ]) => {
						let newRule: TypedRulesV1ResponseItem = {
							...rule,
							_owner: rule.owner,
							owner: undefined,
							id: `rule_${id}`,
							id_v1: `/rules/${id}`,
							type: "rule",
						}
						return newRule;
					})
				);

				resolve(allResources);
			})
			.catch((error) => { reject(error); });
		});
	}

	getBridgeInformation(replaceResources = false): Promise<TypedBridgeV1Response> {
		return new Promise((resolve, reject) => {
			API.request({ config: this.config, resource: "/config", version: 1 })
			.then((bridgeInformation) => {
				// PREPARE TO MATCH V2 RESOURCES
				 const typedBridge: TypedBridgeV1Response = {
					...bridgeInformation,
					type: "bridge",
					id: "bridge",
					id_v1: "/config",
					updated: dayjs().format(),
				 }

				// ALSO REPLACE CURRENT RESOURCE?
				if(replaceResources === true) {
					this.resources[typedBridge.id] = typedBridge;
				}

				// GIVE BACK
				resolve(typedBridge);
			}).catch((error) => reject(error));
		});
	}

	// EMIT INITIAL STATES -> NODES
	emitInitialStates() {
		return new Promise((resolve, reject) => {
			// PUSH STATES
			setTimeout(() => {
				// PUSH ALL STATES
				for (const [id, resource] of Object.entries(this.resources)) {
					this.pushUpdatedState(resource, resource.type, true);
				}

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

	refreshStatesSSE() {
		this.node.log("Subscribing to bridge events…");
		API.subscribe(this.config, (updates) => {
			const currentDateTime = dayjs().format();


			updates.forEach((resource) => {
				let { id, type } = resource;

				let previousState: BasicResourceUnion | false = false;

				// HAS OWNER?
				if (resource.owner) {
					let targetId = resource.owner.rid;

					if (this.resources[targetId]) {
						// GET PREVIOUS STATE
						previousState = this.resources[targetId]["services"][type][id];

						// IS BUTTON? -> REMOVE PREVIOUS STATES
						if(type === "button") {
							Object.keys(this.resources[targetId]["services"]["button"]).forEach((oneButtonID) => {
								delete this.resources[targetId]["services"]["button"][oneButtonID]["button"];
							});
						}
					}
				} else if (this.resources[id]) {
					// GET PREVIOUS STATE
					previousState = this.resources[id];
				}

				// NO PREVIOUS STATE?
				if (previousState) { return false; }

				// CHECK DIFFERENCES
				const mergedState = merge.deep(previousState, resource);
				const updatedResources = diff(previousState, mergedState);

				if(Object.values(updatedResources).length > 0)
				{
					if(resource["owner"])
					{
						let targetId = resource["owner"]["rid"];

						scope.resources[targetId]["services"][type][id] = mergedState;
						scope.resources[targetId]["updated"] = currentDateTime;

						// PUSH STATE
						scope.pushUpdatedState(scope.resources[targetId], resource.type);
					}
					else
					{
						scope.resources[id] = mergedState;
						scope.resources[id]["updated"] = currentDateTime;

						// PUSH STATE
						scope.pushUpdatedState(scope.resources[id], resource.type);
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
			.then(function(status)
			{
				if(scope.nodeActive == true)
				{
					scope.firmwareUpdateTimeout = setTimeout(function(){ scope.autoUpdateFirmware(); }, 60000 * 720);
				}
			})
			.catch(function(error)
			{
				// NO UPDATES AVAILABLE // TRY AGAIN IN 12H
				if(scope.nodeActive == true)
				{
					scope.firmwareUpdateTimeout = setTimeout(function(){ scope.autoUpdateFirmware(); }, 60000 * 720);
				}
			});
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
		this.pushUpdatedState = function(resource, updatedType, suppressMessage = false)
		{
			const msg = { id: resource.id, type: resource.type, updatedType: updatedType, services: resource["services"] ? Object.keys(resource["services"]) : [], suppressMessage: suppressMessage };
			this.events.emit(config.id + "_" + resource.id, msg);
			this.events.emit(config.id + "_" + "globalResourceUpdates", msg);

			// RESOURCE CONTAINS SERVICES? -> SERVICE IN GROUP? -> EMIT CHANGES TO GROUPS ALSO
			if(this.resources["_groupsOf"][resource.id])
			{
				for (var g = this.resources["_groupsOf"][resource.id].length - 1; g >= 0; g--)
				{
					const groupID = this.resources["_groupsOf"][resource.id][g];
					const groupMessage = { id: groupID, type: "group", updatedType: updatedType, services: [], suppressMessage: suppressMessage };

					this.events.emit(config.id + "_" + groupID, groupMessage);
					this.events.emit(config.id + "_" + "globalResourceUpdates", groupMessage);
				}
			}
		}

		// GET RESOURCE (FROM NODES)
		this.get = function(type, id = false, options = {})
		{
			// GET SPECIFIC RESOURCE
			if(id)
			{
				// RESOURCE EXISTS? -> PROCEED
				if(scope.resources[id])
				{
					// RESOLVE LINKS
					const targetResource = scope.resources[id];
					const lastState = scope.lastStates[type+targetResource.id] ? Object.assign({}, scope.lastStates[type+targetResource.id]) : false;

					if(type == "bridge")
					{
						const message = new HueBridgeMessage(targetResource, options);

						// GET CURRENT STATE MESSAGE
						let currentState = message.msg;
						return currentState;
					}
					else if(type == "light")
					{
						const message = new HueLightMessage(targetResource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "group")
					{
						// GET MESSAGE
						const message = new HueGroupMessage(targetResource, { resources: scope.resources, ...options});

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "button")
					{
						const message = new HueButtonsMessage(targetResource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "motion")
					{
						const message = new HueMotionMessage(targetResource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "temperature")
					{
						const message = new HueTemperatureMessage(targetResource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "light_level")
					{
						const message = new HueBrightnessMessage(targetResource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else if(type == "rule")
					{
						const message = new HueRulesMessage(targetResource, options);

						// GET & SAVE LAST STATE AND DIFFERENCES
						let currentState = message.msg;
						scope.lastStates[type+targetResource.id] = Object.assign({}, currentState);
						currentState.updated = (lastState === false) ? {} : diff(lastState, currentState);
						currentState.lastState = lastState;

						return currentState;
					}
					else
					{
						return false;
					}
				}
				else
				{
					return false;
				}
			}
			else
			{
				// FILTER RESOURCES BY TYPE
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
		axios({
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
			axios({
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
			})
			.then((processedResources) => {
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

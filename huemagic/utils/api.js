"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dayjs_1 = __importDefault(require("dayjs"));
const https_1 = __importDefault(require("https"));
const eventsource_1 = __importDefault(require("eventsource"));
function expandResourceLinks(resource, allResources) {
    // We either have an owner _OR_ we have services
    if (resource.type == "device" || resource.type == "room" || resource.type == "zone" || resource.type == "bridge_home") {
        // RESOLVE SERVICES
        let allServices = {};
        resource.services.forEach((service) => {
            // Find the full-size service in allResources
            const fullResource = expandResourceLinks(allResources[service.rid], allResources); // I think unnecessary because no nesting?
            if (!allServices[service.rtype]) {
                allServices[service.rtype] = {};
            }
            allServices[service.rtype][service.rid] = fullResource;
        });
        // REPLACE SERVICES
        let completeResource = {
            ...resource,
            services: allServices
        };
        return completeResource;
    }
    else if ("owner" in resource && resource.owner) {
        let ownerRid = resource.owner.rid;
        return expandResourceLinks(allResources[ownerRid], allResources);
    }
    else {
        // No need for lookup/expansion; just clone
        return { ...resource };
    }
}
class API {
    //
    // INITIALIZE
    static init({ config = null }) {
        // GET BRIDGE
        return new Promise(function (resolve, reject) {
            if (!config) {
                reject("Bridge is not configured!");
                return false;
            }
            // GET BRIDGE INFORMATION
            (0, axios_1.default)({
                "method": "GET",
                "url": "https://" + config.bridge + "/api/config",
                "headers": { "Content-Type": "application/json; charset=utf-8" },
                "httpsAgent": new https_1.default.Agent({ rejectUnauthorized: false }),
            })
                .then(function (response) {
                resolve(response.data);
            })
                .catch(function (error) {
                reject(error);
            });
        });
    }
    //
    // MAKE A REQUEST
    static request({ config = null, method = 'GET', resource = null, data = null, version = 2 }) {
        return new Promise((resolve, reject) => {
            if (!config) {
                reject("Bridge is not configured!");
                return false;
            }
            // BUILD REQUEST OBJECT
            let request = {
                "method": method,
                "url": "https://" + config.bridge,
                "headers": {
                    "Content-Type": "application/json; charset=utf-8",
                    "hue-application-key": config.key
                },
                "httpsAgent": new https_1.default.Agent({ rejectUnauthorized: false }), // Node is somehow not able to parse the official Philips Hue PEM
            };
            // HAS RESOURCE? -> APPEND
            if (resource !== null) {
                let resourceKey = resource;
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
            if (data !== null) {
                request.data = data;
            }
            // RUN REQUEST
            (0, axios_1.default)(request).then((response) => {
                if (version === 2) {
                    if (response.data.errors.length > 0) {
                        reject(response.data.errors);
                    }
                    else {
                        resolve(response.data.data);
                    }
                }
                else if (version === 1) {
                    resolve(response.data);
                }
            })
                .catch(function (error) {
                reject(error);
            });
        });
    }
    //
    // SUBSCRIBE TO BRIDGE EVENTS
    static subscribe(config, callback) {
        return new Promise((resolve, reject) => {
            if (!this.events[config.id]) {
                var sseURL = "https://" + config.bridge + "/eventstream/clip/v2";
                // INITIALIZE EVENT SOURCE
                this.events[config.id] = new eventsource_1.default(sseURL, {
                    headers: { 'hue-application-key': config.key },
                    https: { rejectUnauthorized: false },
                });
                // PIPE MESSAGE TO TARGET FUNCTION
                this.events[config.id].onmessage = (event) => {
                    if (event && event.type === 'message' && event.data) {
                        const messages = JSON.parse(event.data);
                        for (var i = messages.length - 1; i >= 0; i--) {
                            const message = messages[i];
                            if (message.type === "update") {
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
                };
            }
            else {
                this.unsubscribe(config);
                this.subscribe(config, callback);
            }
        });
    }
    //
    // UNSUBSCRIBE
    static unsubscribe(config) {
        if (this.events[config.id] instanceof eventsource_1.default) {
            this.events[config.id].close();
        }
        delete this.events[config.id];
    }
    //
    // GET FULL/ROOT RESOURCE
    //
    // PROCESS RESOURCES
    static processResources(resources) {
        // SET CURRENT DATE/TIME
        const currentDateTime = (0, dayjs_1.default)().format();
        // ACTION!
        return new Promise((resolve, reject) => {
            let resourceList = {};
            let processedResources = { _groupsOf: {} };
            // CREATE ID BASED OBJECT OF ALL RESOURCES
            resources.reduce((memo, resource) => {
                if (resource.type !== "button") {
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
                fullResource.types = [fullResource.type];
                // RESOURCE HAS SERVICES?
                if ("services" in fullResource) {
                    let additionalServiceTypes = Object.keys(fullResource["services"]);
                    // SET ADDITIONAL TYPES BEHIND RECCOURCE
                    fullResource.types = [...fullResource.types, ...additionalServiceTypes];
                }
                // RESOURCE HAS GROUPED SERVICES?
                if ("grouped_services" in fullResource && fullResource.grouped_services) {
                    for (var g = fullResource.grouped_services.length - 1; g >= 0; g--) {
                        const groupedService = fullResource.grouped_services;
                        const groupedServiceID = groupedService.rid;
                        if (!processedResources["_groupsOf"][groupedServiceID]) {
                            processedResources["_groupsOf"][groupedServiceID] = [];
                        }
                        processedResources["_groupsOf"][groupedServiceID].push(fullResource.id);
                    }
                }
                // GIVE FULL RESOURCE BACK TO COLLECTION
                processedResources[fullResource.id] = fullResource;
            });
            resolve(processedResources);
        });
    }
}
// EVENTS
API.events = {};
// EXPORT
module.exports = new API;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HueTemperatureMessage = exports.HueButtonsMessage = exports.HueRulesMessage = exports.HueMotionMessage = exports.HueLightMessage = exports.HueGroupMessage = exports.HueBrightnessMessage = exports.HueBridgeMessage = void 0;
const dayjs = require('dayjs');
const colorUtils = require("./color");
//
// HUE BRIDGE
export type ExpandedBridgeV1Response = BridgeV1Response & { type: "bridge"; }

class HueBridgeMessage {
    constructor(resource, options = {}) {
        this.message = {
            payload: {
                id: resource.bridgeid,
                name: resource.name,
                factoryNew: resource.factorynew,
                replacesBridgeId: resource.replacesbridgeid ? resource.replacesbridgeid : false,
                dataStoreVersion: resource.datastoreversion,
                starterKitId: resource.starterkitid && resource.starterkitid.length > 0 ? resource.starterkitid : false,
                softwareVersion: resource.swversion,
                apiVersion: resource.apiversion,
                zigbeeChannel: resource.zigbeechannel,
                macAddress: resource.mac,
                ipAddress: resource.ipaddress,
                dhcpEnabled: resource.dhcp,
                netmask: resource.netmask,
                gateway: resource.gateway,
                proxyAddress: resource.proxyaddress == "none" ? false : resource.proxyaddress,
                proxyPort: resource.proxyport,
                utcTime: resource.UTC,
                timeZone: resource.timezone,
                localTime: resource.localtime,
                portalServicesEnabled: resource.portalservices,
                portalConnected: resource.portalconnection,
                linkButtonEnabled: resource.linkbutton,
                touchlinkEnabled: (resource["touchlink"] && resource["touchlink"] == true) ? true : false,
                autoUpdatesEnabled: options["autoupdate"] ? options["autoupdate"] : false,
                users: [],
                updated: resource.updated,
                model: {
                    id: resource.modelid,
                    manufacturer: "Philips",
                    name: "Hue v2",
                }
            }
        };
        // GET USERS
        if (resource.whitelist) {
            for (const [userID, user] of Object.entries(resource.whitelist)) {
                this.message.payload.users.push({
                    user: userID,
                    name: user.name,
                    created: user["create date"],
                    lastAccess: user["last use date"]
                });
            }
        }
    }
    get msg() {
        return this.message;
    }
}
exports.HueBridgeMessage = HueBridgeMessage;
//
// HUE BRIGHTNESS
class HueBrightnessMessage {
    constructor(resource, options = {}) {
        const service = Object.values(resource["services"]["light_level"])[0];
        const connectivity = resource.services.zigbee_connectivity ? Object.values(resource.services.zigbee_connectivity)[0] : ((resource.services.zgp_connectivity) ? Object.values(resource.services.zgp_connectivity)[0] : false);
        var realLUX = service.light.light_level - 1;
        realLUX = realLUX / 10000;
        realLUX = Math.round(Math.pow(10, realLUX));
        this.message = { payload: {}, info: {} };
        this.message.payload.active = service.enabled; // NEW!
        this.message.payload.reachable = connectivity ? (connectivity.status === "connected") : "unknown"; // NEW!
        this.message.payload.connectionStatus = connectivity ? connectivity.status : "unknown"; // NEW!
        this.message.payload.lux = realLUX;
        this.message.payload.lightLevel = service.light.light_level;
        this.message.payload.dark = (realLUX < 90);
        this.message.payload.daylight = (realLUX >= 90);
        this.message.payload.updated = resource.updated;
        this.message.info.id = service.id;
        this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false; // NEW
        this.message.info.uniqueId = resource.id + "-" + service.id;
        this.message.info.deviceId = resource.id; // NEW!
        this.message.info.name = resource.metadata.name;
        this.message.info.type = "light_level";
        this.message.info.softwareVersion = resource.product_data.software_version;
        this.message.info.battery = Object.values(resource.services.device_power)[0].power_state.battery_level;
        this.message.info.batteryState = Object.values(resource.services.device_power)[0].power_state.battery_state; // NEW!
        this.message.info.model = {};
        this.message.info.model.id = resource.product_data.model_id;
        this.message.info.model.manufacturer = resource.product_data.manufacturer_name;
        this.message.info.model.name = resource.product_data.product_name;
        this.message.info.model.type = resource.product_data.product_archetype;
        this.message.info.model.certified = resource.product_data.certified; // NEW
    }
    get msg() {
        return this.message;
    }
}
exports.HueBrightnessMessage = HueBrightnessMessage;
//
// HUE GROUP
class HueGroupMessage {
    constructor(resource, options = {}) {
        let service = Object.values(resource["services"]["grouped_light"])[0];
        service = options.resources[service.id];
        // GET ALL RESOURCES
        let allResourcesInsideGroup = {};
        for (const [type, resources] of Object.entries(resource["services"])) {
            allResourcesInsideGroup[type] = Object.keys(resource["services"][type]);
        }
        this.message = { payload: {}, info: {} };
        this.message.payload.on = service.on.on;
        this.message.payload.updated = resource.updated;
        this.message.info.id = resource.id;
        this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false; // NEW
        this.message.info.name = resource.metadata ? resource.metadata.name : "all";
        this.message.info.resources = allResourcesInsideGroup; // NEW
        this.message.info.type = "group";
    }
    get msg() {
        return this.message;
    }
}
exports.HueGroupMessage = HueGroupMessage;
//
// HUE LIGHT
class HueLightMessage {
    constructor(resource, options = {}) {
        const service = Object.values(resource["services"]["light"])[0];
        const connectivity = resource.services.zigbee_connectivity ? Object.values(resource.services.zigbee_connectivity)[0] : ((resource.services.zgp_connectivity) ? Object.values(resource.services.zgp_connectivity)[0] : false);
        this.message = {
            payload: {
                on: service.on ? service.on.on : false,
                brightness: service.dimming ? service.dimming.brightness : false,
                brightnessLevel: service.dimming ? Math.round((254 / 100) * service.dimming.brightness) : false,
                reachable: connectivity ? (connectivity.status === "connected") : "unknown",
                connectionStatus: connectivity ? connectivity.status : "unknown",
                updated: resource.updated,
            },
            info: {
                id: service.id,
                idV1: resource.id_v1 ? resource.id_v1 : false,
                uniqueId: resource.id + "-" + service.id,
                deviceId: resource.id,
                name: service.metadata ? service.metadata.name : "",
                type: "light",
                softwareVersion: resource.product_data.software_version,
                model: {
                    id: resource.product_data.model_id,
                    manufacturer: resource.product_data.manufacturer_name,
                    name: resource.product_data.product_name,
                    type: resource.product_data.product_archetype,
                    certified: resource.product_data.certified,
                    friendsOfHue: true,
                }
            }
        };
        // HAS COLOR CAPABILITIES?
        if (service["color"]) {
            let RGB = colorUtils.xyBriToRgb(service.color.xy.x, service.color.xy.y, (service.dimming ? service.dimming.brightness : 100));
            this.message.payload.rgb = [RGB.r, RGB.g, RGB.b];
            this.message.payload.hex = colorUtils.rgbHex(RGB.r, RGB.g, RGB.b);
            this.message.payload.xyColor = service.color.xy; // NEW!
            if (options.colornames == true) {
                var cNamesArray = colorUtils.colornamer(colorUtils.rgbHex(RGB.r, RGB.g, RGB.b));
                this.message.payload.color = cNamesArray.basic[0]["name"];
            }
            this.message.info.model.colorGamut = service.color.gamut; // NEW
            this.message.info.model.colorGamutType = service.color.gamut_type; // NEW
        }
        // HAS COLOR TEMPERATURE CAPABILITIES?
        if (service["color_temperature"]) {
            this.message.payload.colorTemp = service.color_temperature.mirek ? service.color_temperature.mirek : false;
            if (!this.message.payload.colorTemp) {
                this.message.payload.colorTempName = "unknown";
            }
            else if (this.message.payload.colorTemp < 200) {
                this.message.payload.colorTempName = "cold";
            } // NEW!
            else if (this.message.payload.colorTemp < 350) {
                this.message.payload.colorTempName = "normal";
            }
            else if (this.message.payload.colorTemp < 410) {
                this.message.payload.colorTempName = "warm";
            }
            else {
                this.message.payload.colorTempName = "hot";
            }
        }
        // HAS GRADIENT COLOR CAPABILITIES?
        if (service["gradient"]) // NEW!
         {
            let colors = [];
            service.gradient.points.forEach((gradientColor) => {
                // TODO: Should I have gotten rid of graidentColor.dimming check alongside service.dimming?
                let gradientColorRGB = colorUtils.xyBriToRgb(gradientColor.color.xy.x, gradientColor.color.xy.y, (service.dimming ? service.dimming.brightness : 100));
                let oneColorPack = {
                    rgb: [gradientColorRGB.r, gradientColorRGB.g, gradientColorRGB.b],
                    hex: colorUtils.rgbHex(gradientColorRGB.r, gradientColorRGB.g, gradientColorRGB.b),
                    xyColor: gradientColor.color.xy,
                };
                colors.push(oneColorPack);
            });
            this.message.payload.gradient = {
                colors,
                numColors: service.gradient.points ? service.gradient.points.length : 0,
                totalColors: service.gradient.points_capable,
            };
        }
    }
    get msg() {
        return this.message;
    }
}
exports.HueLightMessage = HueLightMessage;
//
// HUE MOTION
class HueMotionMessage {
    constructor(resource, options = {}) {
        const service = Object.values(resource["services"]["motion"])[0];
        const connectivity = resource.services.zigbee_connectivity ? Object.values(resource.services.zigbee_connectivity)[0] : ((resource.services.zgp_connectivity) ? Object.values(resource.services.zgp_connectivity)[0] : false);
        this.message = { payload: {} };
        this.message.payload = {
            active: service.enabled,
            reachable: connectivity ? (connectivity.status === "connected") : "unknown",
            connectionStatus: connectivity ? connectivity.status : "unknown",
            motion: (service.motion.motion && service.motion.motion_valid),
            updated: resource.updated
        };
        this.message.info = {};
        this.message.info.id = service.id;
        this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false; // NEW
        this.message.info.uniqueId = resource.id + "-" + service.id;
        this.message.info.deviceId = resource.id; // NEW!
        this.message.info.name = resource.metadata.name;
        this.message.info.type = "motion";
        this.message.info.softwareVersion = resource.product_data.software_version;
        this.message.info.battery = Object.values(resource.services.device_power)[0].power_state.battery_level;
        this.message.info.batteryState = Object.values(resource.services.device_power)[0].power_state.battery_state; // NEW!
        this.message.info.model = {};
        this.message.info.model.id = resource.product_data.model_id;
        this.message.info.model.manufacturer = resource.product_data.manufacturer_name;
        this.message.info.model.name = resource.product_data.product_name;
        this.message.info.model.type = resource.product_data.product_archetype;
        this.message.info.model.certified = resource.product_data.certified; // NEW
    }
    get msg() {
        return this.message;
    }
}
exports.HueMotionMessage = HueMotionMessage;
//
// HUE RULES
export type ExpandedRulesV1ResponseItem = RulesV1ResponseItem & { type: "rule"; }

class HueRulesMessage {
    constructor(resource, options = {}) {
        this.message = { payload: {} };
        this.message.payload.enabled = (resource["status"] == "enabled"); // NEW!
        this.message.payload.triggered = (resource["lasttriggered"] != null) ? dayjs(resource["lasttriggered"]).format() : false;
        this.message.info = {};
        this.message.info.id = resource["id"];
        this.message.info.created = dayjs(resource["created"]).format();
        this.message.info.name = resource["name"];
        this.message.info.timesTriggered = resource["timestriggered"];
        this.message.info.owner = resource["_owner"];
        this.message.info.status = resource["status"];
        this.message.conditions = resource["conditions"];
        this.message.actions = resource["actions"];
    }
    get msg() {
        return this.message;
    }
}
exports.HueRulesMessage = HueRulesMessage;
//
// HUE BUTTONS
class HueButtonsMessage {
    constructor(resource, options = {}) {
        const connectivity = resource.services.zigbee_connectivity ? Object.values(resource.services.zigbee_connectivity)[0] : ((resource.services.zgp_connectivity) ? Object.values(resource.services.zgp_connectivity)[0] : false);
        // FIND PRESSED BUTTON
        var pressedButton = false;
        const allButtons = Object.values(resource.services.button);
        for (var i = allButtons.length - 1; i >= 0; i--) {
            if (allButtons[i]["button"]) {
                pressedButton = allButtons[i];
                break;
            }
        }
        this.message = { payload: {} };
        this.message.payload = {
            reachable: connectivity ? (connectivity.status === "connected") : "unknown",
            connectionStatus: connectivity ? connectivity.status : "unknown",
            button: pressedButton ? pressedButton.metadata.control_id : false,
            action: pressedButton ? pressedButton.button.last_event : false,
            updated: resource.updated
        };
        this.message.info = {};
        this.message.info.id = pressedButton ? pressedButton.id : resource.id;
        this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false; // NEW
        this.message.info.uniqueId = resource.id + "-" + (pressedButton ? pressedButton.id : "");
        this.message.info.deviceId = resource.id; // NEW!
        this.message.info.name = resource.metadata.name;
        this.message.info.type = "button";
        this.message.info.softwareVersion = resource.product_data.software_version;
        this.message.info.battery = resource.services.device_power ? Object.values(resource.services.device_power)[0].power_state.battery_level : false;
        this.message.info.batteryState = resource.services.device_power ? Object.values(resource.services.device_power)[0].power_state.battery_state : false; // NEW!
        this.message.info.model = {};
        this.message.info.model.id = resource.product_data.model_id;
        this.message.info.model.manufacturer = resource.product_data.manufacturer_name;
        this.message.info.model.name = resource.product_data.product_name;
        this.message.info.model.type = resource.product_data.product_archetype;
        this.message.info.model.certified = resource.product_data.certified; // NEW
    }
    get msg() {
        return this.message;
    }
}
exports.HueButtonsMessage = HueButtonsMessage;
//
// HUE TEMPERATURE
class HueTemperatureMessage {
    constructor(resource, options = {}) {
        const service = Object.values(resource["services"]["temperature"])[0];
        const connectivity = resource.services.zigbee_connectivity ? Object.values(resource.services.zigbee_connectivity)[0] : ((resource.services.zgp_connectivity) ? Object.values(resource.services.zgp_connectivity)[0] : false);
        var deviceValue = service.temperature.temperature;
        var celsius = Math.round(deviceValue * 100) / 100;
        var fahrenheit = Math.round(((celsius * 1.8) + 32) * 100) / 100;
        // TEMPERATURE MESSAGE
        let temperatureMessage = "comfortable";
        if (celsius < 0) {
            temperatureMessage = "very cold";
        }
        else if (celsius < 11) {
            temperatureMessage = "cold";
        }
        else if (celsius < 16) {
            temperatureMessage = "slightly cold";
        }
        else if (celsius < 22) {
            temperatureMessage = "comfortable";
        }
        else if (celsius < 27) {
            temperatureMessage = "slightly warm";
        }
        else if (celsius < 33) {
            temperatureMessage = "warm";
        }
        else if (celsius < 39) {
            temperatureMessage = "hot";
        }
        else {
            temperatureMessage = "very hot";
        }
        this.message = {
            payload: {
                active: service.enabled,
                reachable: connectivity ? (connectivity.status === "connected") : "unknown",
                connectionStatus: connectivity ? connectivity.status : "unknown",
                celsius: celsius,
                fahrenheit: fahrenheit,
                temperatureIs: temperatureMessage,
                deviceValue: deviceValue,
                updated: resource.updated
            }
        };
        this.message.info = {};
        this.message.info.id = service.id;
        this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false; // NEW
        this.message.info.uniqueId = resource.id + "-" + service.id;
        this.message.info.deviceId = resource.id; // NEW!
        this.message.info.name = resource.metadata.name;
        this.message.info.type = "temperature";
        this.message.info.softwareVersion = resource.product_data.software_version;
        this.message.info.battery = Object.values(resource.services.device_power)[0].power_state.battery_level;
        this.message.info.batteryState = Object.values(resource.services.device_power)[0].power_state.battery_state; // NEW!
        this.message.info.model = {};
        this.message.info.model.id = resource.product_data.model_id;
        this.message.info.model.manufacturer = resource.product_data.manufacturer_name;
        this.message.info.model.name = resource.product_data.product_name;
        this.message.info.model.type = resource.product_data.product_archetype;
        this.message.info.model.certified = resource.product_data.certified; // NEW
    }
    get msg() {
        return this.message;
    }
}
exports.HueTemperatureMessage = HueTemperatureMessage;

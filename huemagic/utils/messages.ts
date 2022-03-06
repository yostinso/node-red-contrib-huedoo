const dayjs = require('dayjs');
const colorUtils = require("./color");
import * as NodeRed from "node-red";
import { Light } from "./resource-types";

interface Message {
    payload: any;
    info?: any;
}
interface HueBridgeMessageContents extends Message {
    payload: { id: string } & HueBridgePayload;
}

interface HueBridgePayload {
    name?: string;
    factoryNew: boolean;
    replacesBridgeId: string | false;
    dataStoreVersion: string;
    starterKitId: string | false;
    softwareVersion: string;
    apiVersion: string;
    zigbeeChannel: number;
    macAddress: string;
    ipAddress: string;
    dhcpEnabled: boolean;
    netmask: string;
    gateway: string;
    proxyAddress: string | false;
    proxyPort: number;
    utcTime: string;
    timeZone: string;
    localTime: string;
    portalServicesEnabled: boolean;
    portalConnected: string;
    linkButtonEnabled: boolean;
    touchlinkEnabled: boolean;
    autoUpdatesEnabled: boolean;
    users: { user: string, name: string, created: string, lastAccess: string }[]
    updated: string | undefined,
    model: { id: string, manufacturer: "Philips", name: "Hue v2" }
}

interface HueBridgeResource {
    bridgeid: string;
    name?: string;
    factorynew: boolean;
    replacesbridgeid: string;
    datastoreversion: string;
    starterkitid?: string;
    swversion: string;
    apiversion: string;
    zigbeechannel: number;
    mac: string;
    ipaddress: string;
    dhcp: boolean;
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
    touchlink?: boolean;
    autoupdate?: boolean;
    updated?: string;
    whitelist?: {
        [userid: string]: {
            "last use date": string;
            "create date": string;
            "name": string;
        }
    }
    modelid: string;
}

//
// HUE BRIDGE
class HueBridgeMessage
{
    private readonly message: HueBridgeMessageContents;

	constructor(resource: HueBridgeResource, options: { autoupdate?: boolean } = {})
	{
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
                users: [], // NEW!
                updated: resource.updated, // NEW!
                model: {
                    id: resource.modelid,
                    manufacturer: "Philips",
                    name: "Hue v2",
                }
            }
        }

		// GET USERS
		if (resource.whitelist) {
			for (const [userID, user] of Object.entries(resource.whitelist))
			{
				this.message.payload.users.push({
					user: userID,
					name: user.name,
					created: user["create date"],
					lastAccess: user["last use date"]
				});
			}
		}
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE BRIGHTNESS
class HueBrightnessMessage
{
    private message: Message;
	constructor(resource: any, options = {})
	{
		const service: any = Object.values(resource["services"]["light_level"])[0];
		const connectivity: any = resource.services.zigbee_connectivity ? Object.values(resource.services.zigbee_connectivity)[0] : ((resource.services.zgp_connectivity) ? Object.values(resource.services.zgp_connectivity)[0] : false);

		var realLUX = service.light.light_level - 1;
		realLUX = realLUX / 10000;
		realLUX = Math.round(Math.pow(10, realLUX));

		this.message = { payload: {}, info: {} }
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
		this.message.info.battery = (Object.values(resource.services.device_power)[0] as any).power_state.battery_level;
		this.message.info.batteryState = (Object.values(resource.services.device_power)[0] as any).power_state.battery_state; // NEW!

		this.message.info.model = {};
		this.message.info.model.id = resource.product_data.model_id;
		this.message.info.model.manufacturer = resource.product_data.manufacturer_name;
		this.message.info.model.name = resource.product_data.product_name;
		this.message.info.model.type = resource.product_data.product_archetype;
		this.message.info.model.certified = resource.product_data.certified; // NEW
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE GROUP
class HueGroupMessage
{
    private message: Message;
	constructor(resource: any, options: any = {})
	{
		let service: any = Object.values(resource["services"]["grouped_light"])[0];
		service = options.resources[service.id];

		// GET ALL RESOURCES
		let allResourcesInsideGroup: any = {};
		for (const [type, resources] of Object.entries(resource["services"]))
		{
			allResourcesInsideGroup[type] = Object.keys(resource["services"][type]);
		}

		this.message = { payload: {}, info: {} }
		this.message.payload.on = service.on.on;
		this.message.payload.updated = resource.updated;

		this.message.info.id = resource.id;
		this.message.info.idV1 = resource.id_v1 ? resource.id_v1 : false; // NEW
		this.message.info.name = resource.metadata ? resource.metadata.name : "all";
		this.message.info.resources = allResourcesInsideGroup; // NEW
		this.message.info.type = "group";
	}

	get msg()
	{
		return this.message;
	}
}


interface HueLightMessageContents extends Message {
    payload: HueLightPayload;
    info: HueLightInfo;
}
type ColorPack = {
    rgb: [ number, number, number ];
    hex: string;
    xyColor: XYColor;
}
type HueLightPayload = {
    on: boolean;
    brightness: number | false;
    brightnessLevel: number | false;
    reachable: string | boolean;
    connectionStatus: string;
    updated: string;
    color?: string;
    colorTemp?: number | false;
    colorTempName?: string;
    rgb?: [ number, number, number ];
    hex?: string;
    xyColor?: XYColor;
    gradient?: {
        colors: ColorPack[];
        numColors: number;
        totalColors: number;
    }
}

interface HueLightInfo {
    id: string;
    idV1: string | boolean;
    uniqueId: string;
    deviceId: string;
    name: string;
    type: "light";
    softwareVersion: string;
    model: {
        id: string;
        manufacturer: string;
        name: string;
        type: string;
        certified: string;
        friendsOfHue: boolean;
        colorGamut?: ColorGamut;
        colorGamutType?: string;
    }
}
type XYColor = { x: number, y: number };
type ColorGamut = { blue: XYColor, red: XYColor, green: XYColor };
type GradientColor = {
    color: { xy: XYColor; }
}
interface HueLightResource {
    services: {
        light: {
            [k: string]: Light
        }
        zigbee_connectivity?: { [k: string]: { status: string } }
        zgp_connectivity?: { [k: string]: { status: string } }
    }
    updated: string;
    id_v1?: string;
    id: string;
    product_data: {
        software_version: string;
        model_id: string;
        manufacturer_name: string;
        product_name: string;
        product_archetype: string;
        certified: string;
    }
}
//
// HUE LIGHT
class HueLightMessage
{
    private message: HueLightMessageContents;
	constructor(resource: HueLightResource, options: any = {})
	{
		const service = Object.values(resource["services"]["light"])[0];
		const connectivity = resource.services.zigbee_connectivity ? Object.values(resource.services.zigbee_connectivity)[0] : ((resource.services.zgp_connectivity) ? Object.values(resource.services.zgp_connectivity)[0] : false);

		this.message = {
            payload: {
                on: service.on ? service.on.on : false,
                brightness: service.dimming ? service.dimming.brightness : false,
                brightnessLevel: service.dimming ? Math.round((254 / 100) * service.dimming.brightness) : false,
                reachable: connectivity ? (connectivity.status === "connected") : "unknown",
                connectionStatus: connectivity ? connectivity.status : "unknown", // NEW!
                updated: resource.updated,
            },
            info: {
                id: service.id,
                idV1: resource.id_v1 ? resource.id_v1 : false, // NEW
                uniqueId: resource.id + "-" + service.id,
                deviceId: resource.id, // NEW!
                name: service.metadata ? service.metadata.name : "",
                type: "light",
                softwareVersion: resource.product_data.software_version,
                model: {
                    id: resource.product_data.model_id,
                    manufacturer: resource.product_data.manufacturer_name,
                    name: resource.product_data.product_name,
                    type: resource.product_data.product_archetype,
                    certified: resource.product_data.certified, // NEW
                    friendsOfHue: true,
                }
            }
        };

		// HAS COLOR CAPABILITIES?
		if(service["color"])
		{
			let RGB = colorUtils.xyBriToRgb(service.color.xy.x, service.color.xy.y, (service.dimming ? service.dimming.brightness : 100));
			this.message.payload.rgb = [RGB.r, RGB.g, RGB.b];
			this.message.payload.hex = colorUtils.rgbHex(RGB.r, RGB.g, RGB.b);
			this.message.payload.xyColor = service.color.xy; // NEW!

			if(options.colornames == true)
			{
				var cNamesArray = colorUtils.colornamer(colorUtils.rgbHex(RGB.r, RGB.g, RGB.b));
				this.message.payload.color = cNamesArray.basic[0]["name"];
			}

			this.message.info.model.colorGamut = service.color.gamut; // NEW
			this.message.info.model.colorGamutType = service.color.gamut_type; // NEW
		}

		// HAS COLOR TEMPERATURE CAPABILITIES?
		if(service["color_temperature"])
		{
			this.message.payload.colorTemp = service.color_temperature.mirek ? service.color_temperature.mirek : false;

			if(!this.message.payload.colorTemp) { this.message.payload.colorTempName = "unknown"; }
			else if(this.message.payload.colorTemp < 200) { this.message.payload.colorTempName = "cold"; } // NEW!
			else if(this.message.payload.colorTemp < 350) { this.message.payload.colorTempName = "normal"; }
			else if(this.message.payload.colorTemp < 410) { this.message.payload.colorTempName = "warm"; }
			else { this.message.payload.colorTempName = "hot"; }
		}

		// HAS GRADIENT COLOR CAPABILITIES?
		if(service["gradient"]) // NEW!
		{

            let colors: ColorPack[] = [];
            service.gradient.points.forEach((gradientColor) => {
                // TODO: Should I have gotten rid of graidentColor.dimming check alongside service.dimming?
				let gradientColorRGB = colorUtils.xyBriToRgb(gradientColor.color.xy.x, gradientColor.color.xy.y, (service.dimming ? service.dimming.brightness : 100));

				let oneColorPack: ColorPack = {
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

	get msg()
	{
		return this.message;
	}
}


//
// HUE MOTION
class HueMotionMessage
{
    private message: Message;
	constructor(resource: any, options = {})
	{
		const service: any = Object.values(resource["services"]["motion"])[0];
		const connectivity: any = resource.services.zigbee_connectivity ? Object.values(resource.services.zigbee_connectivity)[0] : ((resource.services.zgp_connectivity) ? Object.values(resource.services.zgp_connectivity)[0] : false);

		this.message = { payload: {} };
		this.message.payload = {
			active: service.enabled,
			reachable: connectivity ? (connectivity.status === "connected") : "unknown",
			connectionStatus: connectivity ? connectivity.status : "unknown", // NEW!
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
		this.message.info.battery = (Object.values(resource.services.device_power)[0] as any).power_state.battery_level;
		this.message.info.batteryState = (Object.values(resource.services.device_power)[0] as any).power_state.battery_state; // NEW!

		this.message.info.model = {};
		this.message.info.model.id = resource.product_data.model_id;
		this.message.info.model.manufacturer = resource.product_data.manufacturer_name;
		this.message.info.model.name = resource.product_data.product_name;
		this.message.info.model.type = resource.product_data.product_archetype;
		this.message.info.model.certified = resource.product_data.certified; // NEW
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE RULES
class HueRulesMessage
{
    private message: Message & { conditions?: any, actions?: any };
	constructor(resource: any, options = {})
	{
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

	get msg()
	{
		return this.message;
	}
}


//
// HUE BUTTONS
class HueButtonsMessage
{
    private message: Message;
	constructor(resource: any, options = {})
	{
		const connectivity: any = resource.services.zigbee_connectivity ? Object.values(resource.services.zigbee_connectivity)[0] : ((resource.services.zgp_connectivity) ? Object.values(resource.services.zgp_connectivity)[0] : false);

		// FIND PRESSED BUTTON
		var pressedButton: any | false = false;
		const allButtons: any = Object.values(resource.services.button);

		for (var i = allButtons.length - 1; i >= 0; i--)
		{
			if(allButtons[i]["button"])
			{
				pressedButton = allButtons[i];
				break;
			}
		}

		this.message = { payload: {} };
		this.message.payload = {
			reachable: connectivity ? (connectivity.status === "connected") : "unknown", // NEW!
			connectionStatus: connectivity ? connectivity.status : "unknown", // NEW!
			button: pressedButton ? pressedButton.metadata.control_id : false, // NEW
			action: pressedButton ? pressedButton.button.last_event : false, // NEW
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
		this.message.info.battery = resource.services.device_power ? (Object.values(resource.services.device_power)[0] as any).power_state.battery_level : false;
		this.message.info.batteryState = resource.services.device_power ? (Object.values(resource.services.device_power)[0] as any).power_state.battery_state : false; // NEW!

		this.message.info.model = {};
		this.message.info.model.id = resource.product_data.model_id;
		this.message.info.model.manufacturer = resource.product_data.manufacturer_name;
		this.message.info.model.name = resource.product_data.product_name;
		this.message.info.model.type = resource.product_data.product_archetype;
		this.message.info.model.certified = resource.product_data.certified; // NEW
	}

	get msg()
	{
		return this.message;
	}
}


//
// HUE TEMPERATURE
class HueTemperatureMessage
{
    private message: Message;
	constructor(resource: any, options = {})
	{
		const service: any = Object.values(resource["services"]["temperature"])[0];
		const connectivity: any = resource.services.zigbee_connectivity ? Object.values(resource.services.zigbee_connectivity)[0] : ((resource.services.zgp_connectivity) ? Object.values(resource.services.zgp_connectivity)[0] : false);

		var deviceValue = service.temperature.temperature;
		var celsius = Math.round(deviceValue * 100) / 100;
		var fahrenheit = Math.round(((celsius * 1.8)+32) * 100) / 100;

		// TEMPERATURE MESSAGE
		let temperatureMessage = "comfortable";

		if(celsius < 0) {
			temperatureMessage = "very cold";
		}
		else if(celsius < 11) {
			temperatureMessage = "cold";
		}
		else if(celsius < 16) {
			temperatureMessage = "slightly cold";
		}
		else if(celsius < 22) {
			temperatureMessage = "comfortable";
		}
		else if(celsius < 27) {
			temperatureMessage = "slightly warm";
		}
		else if(celsius < 33) {
			temperatureMessage = "warm";
		}
		else if(celsius < 39) {
			temperatureMessage = "hot";
		}
		else {
			temperatureMessage = "very hot";
		}

		this.message = {
            payload: {
                active: service.enabled, // NEW!
                reachable: connectivity ? (connectivity.status === "connected") : "unknown", // NEW!
                connectionStatus: connectivity ? connectivity.status : "unknown", // NEW!
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
		this.message.info.battery = (Object.values(resource.services.device_power)[0] as any).power_state.battery_level;
		this.message.info.batteryState = (Object.values(resource.services.device_power)[0] as any).power_state.battery_state; // NEW!

		this.message.info.model = {};
		this.message.info.model.id = resource.product_data.model_id;
		this.message.info.model.manufacturer = resource.product_data.manufacturer_name;
		this.message.info.model.name = resource.product_data.product_name;
		this.message.info.model.type = resource.product_data.product_archetype;
		this.message.info.model.certified = resource.product_data.certified; // NEW
	}

	get msg()
	{
		return this.message;
	}
}

//
// EXPORT
export {
    HueLightMessageContents,
    HueBridgeMessage, HueBrightnessMessage, HueGroupMessage, HueLightMessage, HueMotionMessage, HueRulesMessage, HueButtonsMessage, HueTemperatureMessage
}


import { isError } from "util";
import { RealResource } from "../resources/generic";
import { BridgeConfig, ApiResponseV1, ApiRequestV1 } from "./api";

export interface ConfigRequest {
	bridge: string;
	key?: string;
}
export interface ConfigResponse extends ApiResponseV1 {
  name: string,
  datastoreversion: string,
  swversion: string,
  apiversion: string,
  mac: string,
  bridgeid: string,
  factorynew: boolean,
  replacesbridgeid: string | null,
  modelid: string,
  starterkitid: string
}

export interface BridgeRequest extends ApiRequestV1<undefined> {
	config: BridgeConfig;
	data?: undefined;
}

type BridgeUpdate = {
	swupdate2: {
		checkforupdate: boolean;
		install: boolean;
	}
}

export interface BridgeAutoupdateRequest extends ApiRequestV1<BridgeUpdate> {
	config: BridgeConfig;
	data: BridgeUpdate
}

export interface BridgeV1Response extends ApiResponseV1 {
    name: string;
	bridgeid: string;
	factorynew: boolean;
	replacesbridgeid: string | null;
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
	portalstate?: {
		signedon: boolean,
		incoming: boolean,
		outgoing: boolean,
		communication: string
	},
	linkbutton: boolean;
	internetservices?: {
		internet: string,
		remoteaccess: string,
		time: string,
		swupdate: string
	},
	updated?: string;
	modelid: string;
    zigbeechannel: number;
    mac: string;
    dhcp: boolean;
	backup?: {
		status: string,
		errorcode: number
	},

	swupdate?: {
		updatestate: number,
		checkforupdate: boolean,
		devicetypes: {
			bridge: boolean,
			lights: string[],
			sensors: string[]
		},
		url: string,
		text: string,
		notify: boolean
	},
	swupdate2?: {
		checkforupdate: boolean,
		lastchange: string,
		bridge: {
			state: string,
			lastinstall: string,
		},
		state: string,
		autoinstall: {
			updatetime: string,
			on: boolean
		}
	},

	whitelist: {
		[ id: string ]: {
			"last use date": string;
			"create date": string;
			name: string;
		}
	}
};

type BridgeConfigV1ResponseSuccess = {
	success: { [path: string]: number|boolean|string }
}
export type BridgeConfigV1ResponseError = {
	error: {
		type: number,
		address: string,
		description: string
	}
}
type BridgeConfigV1ResponseItem = BridgeConfigV1ResponseSuccess | BridgeConfigV1ResponseError;
export type BridgeConfigV1Response = (BridgeConfigV1ResponseItem)[]
export function isBridgeConfigV1ResponseError(item: BridgeConfigV1ResponseItem): item is BridgeConfigV1ResponseError {
	return "error" in item;
}

export interface Bridge extends RealResource<"bridge">, Omit<BridgeV1Response, "bridgeid"> {
	
}
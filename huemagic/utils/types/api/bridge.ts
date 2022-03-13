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

export interface Bridge extends RealResource<"bridge">, Omit<BridgeV1Response, "bridgeid"> {
	
}
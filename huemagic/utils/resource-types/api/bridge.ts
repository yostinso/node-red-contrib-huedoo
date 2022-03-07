import { BridgeConfig } from "./api";

export type BridgeRequestArgs = {
	method?: "GET";
	config: BridgeConfig;
	data?: undefined;
	resource: "/config";
	version: 1;
}
export type BridgeV1Response = {
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
export type BridgeAutoupdateArgs = {
	config: BridgeConfig;
	resource: "/config";
	version: 1;
	method: "PUT";
	data: {
		swupdate2: {
			checkforupdate: boolean;
			install: boolean;
		}
	}
}
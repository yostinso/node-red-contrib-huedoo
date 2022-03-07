import { BridgeConfig } from "./api";

export type RulesRequestArgs = {
	method?: "GET";
	config: BridgeConfig;
	data?: undefined;
	resource: "/rules";
	version: 1;
}
export type RulesV1ResponseItem = {
    name: string;
    lasttriggered: string;
    creationtime: string;
    timestriggered: number;
    owner: string;
    status: string;
    conditions: {
        address: string;
        operator: string;
        value?: string;
    }[]
    actions: {
        address: string;
        method: "GET" | "PUT" | "DELETE";
        body: object
    }[]
};
export type RulesV1Response = {
    [ index: string ]: RulesV1ResponseItem
};
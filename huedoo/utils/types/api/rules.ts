import { Method } from "axios";
import { RealResource, ResourceRef } from "../resources/generic";
import { ApiRequestV1, ApiResponseV1, BridgeConfig } from "./api";

export interface RulesRequest extends ApiRequestV1<undefined> {
	config: BridgeConfig;
	data?: undefined;
}
export interface RulesV1ResponseItem {
    name: string;
    lasttriggered: string;
    created: string;
    timestriggered: number;
    owner: string;
    status: string;
    recycle?: boolean;
    conditions: {
        address: string;
        operator: string;
        value?: string;
    }[]
    actions: {
        address: string;
        method: Method;
        body: object
    }[]
};
export interface RulesV1Response extends ApiResponseV1 {
    [ index: string ]: RulesV1ResponseItem
};

export interface Rule extends RealResource<"rule">, Omit<RulesV1ResponseItem, "owner"> {
    _owner: string; // This is not a ResourceRef
}
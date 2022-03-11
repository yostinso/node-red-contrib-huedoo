import { Axios, AxiosResponse, Method } from "axios";

export interface BridgeConfig {
	bridge: string;
	key: string;
}
export interface BridgeConfigWithId extends BridgeConfig {
	id: string;
}

export type InitArgs = { config: BridgeConfig | null }

export interface ApiRequest<D, V = 1|2> {
	config: BridgeConfig;
	method: Method;
	version: V;
	data?: D;
}

export interface ApiRequestV1<D> extends ApiRequest<D, 1> {
	
}
export interface ApiRequestV2<D> extends ApiRequest<D, 2> {
	
}

export interface ApiResponseV1 { }

export interface ApiResponseData { }
export interface ApiResponseV2<T extends ApiResponseData> {
	errors?: string[];
	data: T;
}
import { Axios, AxiosResponse, Method } from "axios";

export interface BridgeConfig {
	bridge: string;
	key: string;
}
export interface BridgeConfigWithId extends BridgeConfig {
	id: string;
}

export interface ApiRequest<D> {
	config: BridgeConfig;
	data?: D;
}

export interface ApiRequestV1<D> extends ApiRequest<D> {
	
}
export interface ApiRequestV2<D> extends ApiRequest<D> {
	
}

export interface ApiResponseV1 { }

export interface ApiResponseData { }
export interface ApiResponseV2<T extends ApiResponseData> {
	errors?: string[];
	data: T;
}
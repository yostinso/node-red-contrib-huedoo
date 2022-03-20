import { APIStaticInterface } from "../api";
import { BridgeConfigWithId } from "../types/api/api";
import { BridgeAutoupdateRequest, BridgeConfigV1Response, BridgeRequest, BridgeV1Response, ConfigResponse } from "../types/api/bridge";
import { EventUpdateResponse } from "../types/api/event";
import { AllResourcesRequest, ResourceRequest, ResourceResponse, ResourcesRequest } from "../types/api/resource";
import { RulesRequest, RulesV1Response } from "../types/api/rules";
import { RealResource, RealResourceType } from "../types/resources/generic";
import { defaultBridgeConfig } from "../__fixtures__/api/config";
import { defaultResources } from "../__fixtures__/api/resources";
import { defaultRules } from "../__fixtures__/api/rules";

function staticImplements<T>() {
    return <U extends T>(constructor: U) => {constructor};
}
@staticImplements<APIStaticInterface>()
class mockAPI {
    static init = jest.fn().mockImplementation(
        (config: BridgeConfigWithId): Promise<ConfigResponse> => {
            return Promise.resolve({
                name: "Philips hue",
                datastoreversion: "117",
                swversion: "1949203030",
                apiversion: "1.48.0",
                mac: "aa:bb:cc:dd:ee:ff",
                bridgeid: "DEADBEEF01234567",
                factorynew: false,
                replacesbridgeid: null,
                modelid: "BSB002",
                starterkitid: ""
            });
        }
    )
    static rules = jest.fn().mockImplementation(
        (request: RulesRequest): Promise<RulesV1Response> => {
            return Promise.resolve(defaultRules);
        }
    )
    static config = jest.fn().mockImplementation(
        (request: BridgeRequest): Promise<BridgeV1Response> => {
            return Promise.resolve(defaultBridgeConfig)
        }
    )
    static setBridgeUpdate = jest.fn().mockImplementation(
        (request: BridgeAutoupdateRequest): Promise<BridgeConfigV1Response> => {
            const response: BridgeConfigV1Response = [
                { success: { "/config/swupdate2/checkforupdate": true } },
                { success: { "/config/swupdate2/install": true } },
            ];
            return Promise.resolve(response);
        }
    )
    static getAllResources = jest.fn().mockImplementation(
        (request: AllResourcesRequest): Promise<ResourceResponse<any>[]> => {
            return Promise.resolve(defaultResources);
        }
    )
    static getResources = jest.fn().mockImplementation(
        <T extends RealResourceType>(request: ResourcesRequest<T>): Promise<ResourceResponse<T>[]> => {
            throw new Error("not implemented");
        }
    )
    static getResource = jest.fn().mockImplementation(
        <R extends RealResourceType, T extends ResourceRequest<R>>(request: T): Promise<ResourceResponse<R>> => {
            throw new Error("not implemented");
        }
    )
    static subscribe = jest.fn().mockImplementation(
        (config: BridgeConfigWithId, callback: (data: EventUpdateResponse<RealResource<any>>[]) => void) => {
            return Promise.resolve(true);
        }
    )

    static unsubscribe = jest.fn().mockImplementation(
        (config: BridgeConfigWithId): void => {
            throw new Error("not implemented");
        }
    )
}

export default mockAPI;
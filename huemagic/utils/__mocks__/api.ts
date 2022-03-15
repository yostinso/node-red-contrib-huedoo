import { APIStaticInterface } from "../api";
import { BridgeConfigWithId } from "../types/api/api";
import { BridgeAutoupdateRequest, BridgeRequest, BridgeV1Response, ConfigResponse } from "../types/api/bridge";
import { EventUpdateResponse } from "../types/api/event";
import { AllResourcesRequest, ResourceRequest, ResourceResponse, ResourcesRequest } from "../types/api/resource";
import { RulesRequest, RulesV1Response } from "../types/api/rules";
import { RealResource, RealResourceType } from "../types/resources/generic";

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
    ),
    static rules = jest.fn().mockImplementation(
        (request: RulesRequest): Promise<RulesV1Response> => {
            return Promise.resolve({
                "1": {
                    "name": "1:",
                    "owner": "773a6426-a3f5-11ec-af60-00155d1a2b49",
                    "created": "2022-02-22T22:22:22",
                    "lasttriggered": "none",
                    "timestriggered": 0,
                    "status": "enabled",
                    "recycle": true,
                    "conditions": [
                        {
                            "address": "/groups/2/state/all_on",
                            "operator": "eq",
                            "value": "false"
                        },
                        {
                            "address": "/groups/2/state/all_on",
                            "operator": "dx"
                        },
                        {
                            "address": "/sensors/44/state/status",
                            "operator": "gt",
                            "value": "0"
                        }
                    ],
                    "actions": [
                        {
                            "address": "/sensors/44/state",
                            "method": "PUT",
                            "body": {
                                "status": 0
                            }
                        }
                    ]
                }
            });
        }
    )
    static config = jest.fn().mockImplementation(
        (request: BridgeRequest): Promise<BridgeV1Response> => {
            return Promise.resolve({
            });
        }
    )
    static setBridgeUpdate(request: BridgeAutoupdateRequest): Promise<BridgeV1Response>
    static getAllResources = jest.fn().mockImplementation(
        (request: AllResourcesRequest): Promise<ResourceResponse<any>[]> => {
            return Promise.resolve({
            });
        }
    )
    static getResources = jest.fn().mockImplementation(
        <T extends RealResourceType>(request: ResourcesRequest<T>): Promise<ResourceResponse<T>[]> => {
            return Promise.resolve({
            });
        }
    )
    static getResource = jest.fn().mockImplementation(
        <R extends RealResourceType, T extends ResourceRequest<R>>(request: T): Promise<ResourceResponse<R>> => {
            return Promise.resolve({
            });
        }
    )
    static subscribe = jest.fn().mockImplementation(
        (config: BridgeConfigWithId, callback: (data: EventUpdateResponse<RealResource<any>>[])) => {

        }
    )

    static unsubscribe = jest.fn().mockImplementation(
        (config: BridgeConfigWithId): void => {
            
        }
    )
}

export default mockAPI;
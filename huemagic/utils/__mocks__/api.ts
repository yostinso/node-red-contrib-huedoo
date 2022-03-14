import { BridgeConfigWithId } from "../types/api/api";
import { ConfigResponse } from "../types/api/bridge";

const mockAPI = {
    init: jest.fn().mockImplementation(
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
}

export default mockAPI;
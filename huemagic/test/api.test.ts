//import { expect } from "chai";

const axiosRequestMock = jest.fn();
jest.mock("axios", () => {
    return {
        request: axiosRequestMock
    }
});

import exp from "constants";
import API, { makeAxiosRequestV2 } from "../utils/api";
import { ApiRequestV2 } from "../utils/types/api/api";

const BRIDGE = "bridge-" + Math.random();
const BRIDGE_KEY = "key-" + Math.random();
const config = {
    bridge: BRIDGE,
    key: BRIDGE_KEY,
};

beforeEach(() => {
    axiosRequestMock.mockClear();
    axiosRequestMock.mockReset();
});

describe(API, () => {
    describe("V1 endpoints", () => {
        it("should make a valid V1 request and set the Content-Type and httpsAgent", () => {
            const promise = API.rules({
                config,
                method: "GET",
                version: 1
            });
            expect(axiosRequestMock).toBeCalledTimes(1);
            expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                url: expect.stringMatching(new RegExp(`^https:\/\/${BRIDGE}\/api\/${BRIDGE_KEY}`)),
                headers: expect.objectContaining({
                    "Content-Type": expect.stringContaining("application/json")
                }),
                httpsAgent: expect.objectContaining({})
            }));
            return promise;
        });
        describe(API.rules, () => {
            it("should request rules", () => {
                const promise = API.rules({
                    config,
                    method: "GET",
                    version: 1
                });
                expect(axiosRequestMock).toBeCalledTimes(1);
                expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                    url: `https://${BRIDGE}/api/${BRIDGE_KEY}/rules`,
                    method: "GET",
                    data: undefined,
                }));
                return promise;
            });
        });
        describe(API.config, () => {
            it("should request config", () => {
                const promise = API.config({
                    config,
                    method: "GET",
                    version: 1,
                });
                expect(axiosRequestMock).toBeCalledTimes(1);
                expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                    url: `https://${BRIDGE}/api/${BRIDGE_KEY}/config`,
                    method: "GET",
                    data: undefined
                }));
                return promise;
            });
        });
        describe(API.setBridgeUpdate, () => {
            it("should set the swupdate object", () => {
                const promise = API.setBridgeUpdate({
                    config,
                    method: "PUT",
                    version: 1,
                    data: {
                        swupdate2: { checkforupdate: true, install: true }
                    }
                });
                expect(axiosRequestMock).toBeCalledTimes(1);
                expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                    url: `https://${BRIDGE}/api/${BRIDGE_KEY}/config`,
                    method: "PUT",
                    data: {
                        swupdate2: { checkforupdate: true, install: true }
                    }
                }));
                return promise;
            });
        });
    });
    describe("V2 endpoints", () => {
        const BASE_GET = {
            config,
            method: "GET",
            version: 2,
        } as const;
        beforeEach(() => {
            axiosRequestMock.mockResolvedValue({ data: {} });
        })
        describe(makeAxiosRequestV2, () => {
            it("should strip off data for a GET request", () => {
                return expect(makeAxiosRequestV2({
                    config,
                    method: "GET",
                    version: 2,
                    data: "Some data"
                }, "test")).resolves.toEqual({});
            });
        });
        it("should make a valid V2 request and set the Content-Type and httpsAgent", () => {
            const promise = API.getAllResources(BASE_GET);
            expect(axiosRequestMock).toBeCalledTimes(1);
            expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                url: expect.stringMatching(new RegExp(`^https:\/\/${BRIDGE}\/clip\/v2\/`)),
                headers: expect.objectContaining({
                    "Content-Type": expect.stringContaining("application/json"),
                    "hue-application-key": BRIDGE_KEY
                }),
                httpsAgent: expect.objectContaining({})
            }));
            return promise;
        });
        it("should make a valid V2 request and handle errors", () => {
            axiosRequestMock.mockResolvedValue({ errors: [ "error message"] });
            return expect(
                API.getAllResources(BASE_GET)
            ).rejects.toThrowError(/Error.*error message/);
        });
        describe(API.getAllResources, () => {
            it("should request all resources", () => {
                const result = API.getAllResources(BASE_GET);
                expect(axiosRequestMock).toBeCalledTimes(1);
                expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                    url: `https://${BRIDGE}/clip/v2/resource`,
                    method: "GET"
                }));
                return result;
            });
        });
    });
});
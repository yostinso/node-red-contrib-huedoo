const axiosRequestMock = jest.fn();
jest.mock("axios", () => {
    return {
        request: axiosRequestMock
    }
});

const eventSourceConstructor = jest.fn();
jest.mock("eventsource", () => eventSourceConstructor);


import API, { makeAxiosRequestV2 } from "../api";

const BRIDGE = "bridge-" + Math.random();
const BRIDGE_KEY = "key-" + Math.random();
const config = {
    bridge: BRIDGE,
    key: BRIDGE_KEY,
};

beforeEach(() => {
    axiosRequestMock.mockReset();
});

describe(API, () => {
    describe("V1 endpoints", () => {
        it("should make a valid V1 request and set the Content-Type and httpsAgent", () => {
            const promise = API.rules({ config });
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
                const promise = API.rules({ config });
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
                const promise = API.config({ config });
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
                    data: {
                        swupdate2: { checkforupdate: true, install: true }
                    }
                });
                expect(axiosRequestMock).toBeCalledTimes(1);
                expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                    url: `https://${BRIDGE}/api/${BRIDGE_KEY}/config`,
                    data: {
                        swupdate2: { checkforupdate: true, install: true }
                    }
                }));
                return promise;
            });
        });
        describe(API.init, () => {
            it("should reject if you manage to give it a bad config", () => {
                axiosRequestMock.mockResolvedValue({});
                const promise = API.init({ bridge: "" });
                return expect(promise).rejects.toMatch(/not configured/);
            });
            it("should reject any networking errors", () => {
                axiosRequestMock.mockRejectedValue("boom");
                const promise = API.init(config);
                return expect(promise).rejects.toMatch(/boom/);
            });
            it("should request the unauthenticated bridge info", () => {
                axiosRequestMock.mockResolvedValue({});
                const promise = API.init(config);
                expect(axiosRequestMock).toBeCalledTimes(1);
                expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                    url: `https://${BRIDGE}/api/config`,
                }));
                return promise;
            });
        });
    });
    describe("V2 endpoints", () => {
        const BASE_GET = { config } as const;
        beforeEach(() => {
            axiosRequestMock.mockResolvedValue({ data: {} });
        })
        describe(makeAxiosRequestV2, () => {
            it("should strip off data for a GET request", () => {
                const promise = makeAxiosRequestV2({
                    config,
                    method: "GET",
                    data: "Some data"
                }, "test");
                expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                    data: undefined
                }));
                
                return promise;
            });
            it("should keep data for a PUT request", () => {
                const promise = makeAxiosRequestV2({
                    config,
                    method: "PUT",
                    data: "Some data"
                }, "test");
                expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                    data: "Some data",
                }));
                
                return promise;
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
        describe(API.getResources, () => {
            it("should request all resources", () => {
                const type = "light";
                const result = API.getResources({ ...BASE_GET, resource: type });
                expect(axiosRequestMock).toBeCalledTimes(1);
                expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                    url: `https://${BRIDGE}/clip/v2/resource/${type}`,
                    method: "GET"
                }));
                return result;
            });
        });
        describe(API.getResource, () => {
            it("should request all resources", () => {
                const type = "light";
                const id = "123";
                const result = API.getResource({ ...BASE_GET, resource: type, data: id });
                expect(axiosRequestMock).toBeCalledTimes(1);
                expect(axiosRequestMock).toBeCalledWith(expect.objectContaining({
                    url: `https://${BRIDGE}/clip/v2/resource/${type}/${id}`,
                    method: "GET"
                }));
                return result;
            });
        });
    });
    describe("Event streaming", () => {
        const configWithId = { ...config, id: BRIDGE }
        const cb = jest.fn();
        const closeMock = jest.fn();
        let mockEventSource: { onopen?: Function, close?: Function, onmessage?: Function, onerror?: Function };
        beforeEach(() => {
            eventSourceConstructor.mockReset();
            cb.mockClear();
            closeMock.mockClear();
            mockEventSource = { close: closeMock };
            eventSourceConstructor.mockImplementation(() => { return mockEventSource });
        });

        describe(API.unsubscribe, () => {
            it("should remove a subscribed eventsource", () => {
                const promise = API.subscribe(configWithId, () => {})
                if (mockEventSource.onopen) { mockEventSource.onopen(); }
                API.unsubscribe(configWithId);
                expect(closeMock).toBeCalledTimes(1);
                return promise;
            });
        });
        describe(API.subscribe, () => {
            afterEach(() => { API.unsubscribe(configWithId); })
            it("should initiate a subscription", () => {
                const promise = API.subscribe(configWithId, cb);
                expect(eventSourceConstructor).toBeCalledTimes(1);
                expect(eventSourceConstructor).toBeCalledWith(
                    `https://${BRIDGE}/eventstream/clip/v2`,
                    expect.objectContaining({
                        headers: { "hue-application-key": BRIDGE_KEY }
                    })
                );
                expect(mockEventSource.onopen).not.toBeUndefined();
                if (mockEventSource.onopen) { mockEventSource.onopen(); }
                return promise;
            });
            describe("when subscribed", () => {
                it("should resolve once the connection opens", () => {
                    const promise = API.subscribe(configWithId, cb);
                    expect(mockEventSource.onopen).not.toBeUndefined();
                    if (mockEventSource.onopen) { mockEventSource.onopen(); }
                    return promise;
                });
                it("should unsubscribe and resubscribe if called twice", () => {
                    const promise = API.subscribe(configWithId, cb);
                    if (mockEventSource.onopen) { mockEventSource.onopen(); }
                    expect(closeMock).not.toBeCalled();

                    return promise.then(() => {
                        const promise2 = API.subscribe(configWithId, cb);
                        if (mockEventSource.onopen) { mockEventSource.onopen(); }
                        expect(closeMock).toBeCalledTimes(1);
                        return promise2;
                    })
                });

                let event: {
                    type: string,
                    data: string, // JSON array [{ type: "update", data: any }]
                };
                let data: {
                    type: string,
                    data: any,
                }[];

                it("should not forward events that aren't messages", () => {
                    data = [];
                    event = { type: "not a message", data: JSON.stringify(data) }
                    const promise = API.subscribe(configWithId, cb);
                    if (mockEventSource.onopen) { mockEventSource.onopen(); }
                    expect(mockEventSource.onmessage).not.toBeUndefined();
                    if (mockEventSource.onmessage) {
                        mockEventSource.onmessage(event);
                        expect(cb).not.toBeCalled();
                    }

                    return promise;
                });
                it("should not forward events that aren't update messages", () => {
                    data = [{ type: "delete", data: "no" }];
                    event = { type: "message", data: JSON.stringify(data) }
                    const promise = API.subscribe(configWithId, cb);
                    if (mockEventSource.onopen) { mockEventSource.onopen(); }
                    expect(mockEventSource.onmessage).not.toBeUndefined();
                    if (mockEventSource.onmessage) {
                        mockEventSource.onmessage(event);
                        expect(cb).not.toBeCalled();
                    }

                    return promise;
                });
                it("should forward events that are update messages", () => {
                    data = [{ type: "update", data: "yes" }];
                    event = { type: "message", data: JSON.stringify(data) }
                    const promise = API.subscribe(configWithId, cb);
                    if (mockEventSource.onopen) { mockEventSource.onopen(); }
                    expect(mockEventSource.onmessage).not.toBeUndefined();
                    if (mockEventSource.onmessage) {
                        mockEventSource.onmessage(event);
                        expect(cb).toBeCalledTimes(1);
                        expect(cb).toBeCalledWith("yes");
                    }
                    return promise;
                });
                it("should forward multiple messages", () => {
                    data = [{ type: "update", data: "yes" }, { type: "update", data: "yes2" }];
                    event = { type: "message", data: JSON.stringify(data) }
                    const promise = API.subscribe(configWithId, cb);
                    if (mockEventSource.onopen) { mockEventSource.onopen(); }
                    expect(mockEventSource.onmessage).not.toBeUndefined();
                    if (mockEventSource.onmessage) {
                        mockEventSource.onmessage(event);
                        expect(cb).toBeCalledTimes(2);
                        expect(cb).toBeCalledWith("yes");
                        expect(cb).toBeCalledWith("yes2");
                    }
                    return promise;

                });
                it("should retry on error", () => {
                    jest.useFakeTimers();
                    jest.spyOn(global, "setTimeout");
                    const promise = API.subscribe(configWithId, cb);
                    if (mockEventSource.onopen) { mockEventSource.onopen(); }
                    expect(eventSourceConstructor).toBeCalledTimes(1);
                    if (mockEventSource.onerror) {
                        mockEventSource.onerror("test");
                        expect(setTimeout).toHaveBeenCalledTimes(1);
                        jest.runAllTimers();
                        if (mockEventSource.onopen) { mockEventSource.onopen(); }
                        expect(eventSourceConstructor).toBeCalledTimes(2);
                    }
                    jest.useRealTimers();
                    return promise;
                });
            });
        });
    });
});
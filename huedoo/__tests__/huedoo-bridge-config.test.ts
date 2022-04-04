const OrigEventEmitter = jest.requireActual("events");
jest.mock("events");

jest.mock("node-red");
jest.mock("../utils/api");
jest.mock("dayjs", () => {
    const dayjs = jest.requireActual("dayjs");
    return jest.fn().mockImplementation((...args) => dayjs(...args));
});

import { randomUUID } from "crypto";
import _dayjs from "dayjs";
import { EventEmitter as _EventEmitter } from "events";
import { Node, NodeAPI } from "node-red";
import { HueBridgeConfig, HueBridgeDef, UpdatedResourceEvent } from "../huedoo-bridge-config";
import API from "../utils/api";
import { Bridge } from "../utils/types/api/bridge";
import { Resource } from "../utils/types/api/resource";
import { RulesV1ResponseItem } from "../utils/types/api/rules";
import { ExpandedResource, expandedResources, ExpandedServiceOwnerResource } from "../utils/types/expanded/resource";
import { ResourceType, ServiceOwnerResourceType } from "../utils/types/resources/generic";
import { defaultBridgeConfig } from "../utils/__fixtures__/api/config";
import { makeEvent } from "../utils/__fixtures__/api/event";
import { defaultResources, makeButtonGroup, makeDevice, makeLight } from "../utils/__fixtures__/api/resources";
import { defaultRules } from "../utils/__fixtures__/api/rules";


const EventEmitter = _EventEmitter as jest.MockedClass<typeof _EventEmitter>;

const dayjs = jest.mocked(_dayjs);

const nodeLog = jest.fn().mockName("nodeLog");
const nodeWarn = jest.fn().mockName("nodeWarn");

const node: Node = {
    log: nodeLog,
    warn: nodeWarn
} as unknown as Node;


const BRIDGE = "bridge-" + Math.random();
const BRIDGE_KEY = "key-" + Math.random();
const config: HueBridgeDef = {
    bridge: BRIDGE,
    key: BRIDGE_KEY,
    id: "bridge",
    type: "hue-bridge-config",
    name: "my bridge",
    z: "wat"
}
function mockInstantTimeout() {
    jest.useFakeTimers();
    const mockTimeout = jest.spyOn(global, "setTimeout").mockImplementation(
        (cb, ms) => {
            const t = setImmediate(cb);
            jest.runAllTimers();
            return t as unknown as NodeJS.Timeout;
        }
    );
    return mockTimeout;
}

type FunctionPropertyNames<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never }[keyof T] & string;
function mockRunMethodOnceAndThenNoop<T extends {}, M extends FunctionPropertyNames<Required<T>>>(object: T, method: M) {
    const orig = (object as any)[method];
    const mock = jest.spyOn(object, method);
    mock.mockImplementationOnce(orig);
    mock.mockResolvedValue(true as any);
    return mock;
}
const RED: NodeAPI = {} as unknown as NodeAPI;

describe(HueBridgeConfig, () => {
    beforeEach(() => {
        nodeLog.mockClear();
        nodeWarn.mockClear();
    });
    it("should be constructable", () => {
        expect(() => new HueBridgeConfig(node, config, RED)).not.toThrow();
    });

    describe("after construction", () => {
        let bridgeConfigNode!: HueBridgeConfig;
        beforeEach(() => {
            bridgeConfigNode = new HueBridgeConfig(node, config, RED);
        });

        describe(HueBridgeConfig.prototype.start, () => {
            it("should retry a connection on connection failure", async () => {
                jest.useFakeTimers();
                mockInstantTimeout();

                // Mock .start to just resolve(true) after running the first time
                const mockStart = mockRunMethodOnceAndThenNoop(bridgeConfigNode, "start");

                // Trigger an error so we retry
                jest.mocked(API.init).mockRejectedValueOnce("error message");

                await bridgeConfigNode.start();
                expect(nodeLog).toBeCalledTimes(2);
                expect(nodeLog).toBeCalledWith("error message");

                jest.useRealTimers();
            });
            it("should not retry when the node is disabled", () => {
                bridgeConfigNode.enabled = false;
                jest.mocked(API.init).mockRejectedValueOnce("error message");
                const result = expect(bridgeConfigNode.start()).resolves.toBe(false);
                return result;
            });
            it("should fetch all resources", async () => {
                const getAllResourcesMock = jest.spyOn(bridgeConfigNode, "getAllResources");
                await bridgeConfigNode.start();
                expect(getAllResourcesMock).toBeCalled();
            })
            it("should emit initial resources", async () => {
                const pushStateMock = jest.spyOn(bridgeConfigNode, "pushUpdatedState")
                pushStateMock.mockClear();

                await bridgeConfigNode.start();
                pushStateMock.mockReturnValue();
                let expectedResourceIds = [
                    ...defaultResources.map((r) => r.id),
                    "bridge",
                    ...Object.keys(defaultRules).map((id) => `rule_${id}`)
                ].sort();
                let emittedResourceIds = pushStateMock.mock.calls.map((c) => c[0].id).sort();
                expect(emittedResourceIds).toEqual(expectedResourceIds);
            });
            it("should subscribe to events and kick off firmware updates", async () => {
                await bridgeConfigNode.start();
                expect(API.subscribe).toBeCalled();
                expect(API.setBridgeUpdate).toBeCalled();
            })
        })

        describe(HueBridgeConfig.prototype.getBridgeInformation, () => {
            it("should fetch and generate a bridge config", () => {
                return expect(bridgeConfigNode.getBridgeInformation()).resolves.toEqual(expect.objectContaining({
                    ...defaultBridgeConfig,
                    id: "bridge",
                    id_v1: "/config",
                    type: "bridge",
                    updated: expect.stringMatching(/.*T.*/)
                }));
            });
            it("should not replace the bridge entry if replaceResources is true", async () => {
                await bridgeConfigNode.getBridgeInformation();
                expect(bridgeConfigNode.resources["bridge"]).toBeUndefined();
            });
            it("should replace the bridge entry if replaceResources is true", async () => {
                await bridgeConfigNode.getBridgeInformation(true);
                expect(bridgeConfigNode.resources["bridge"]).toEqual(expect.objectContaining({
                    type: "bridge",
                    id: "bridge"
                }));
            });
            it("should reject on API failure", () => {
                jest.mocked(API.config).mockRejectedValueOnce("error message");
                const result = expect(bridgeConfigNode.getBridgeInformation()).rejects.toEqual("error message");
                return result;
            });
        });
        describe(HueBridgeConfig.prototype.getAllResources, () => {
            it("should include the bridge in the results", () => {
                jest.spyOn(bridgeConfigNode, "getBridgeInformation").mockImplementation(() => {
                    return Promise.resolve({ type: "bridge", id: "mockBridge" }) as Promise<Bridge>;
                });
                let resources = bridgeConfigNode.getAllResources();
                return expect(resources).resolves.toContainEqual(expect.objectContaining({
                    id: "mockBridge",
                    type: "bridge"
                }));
            });
            it("should include rules in the results", () => {
                jest.mocked(API.rules).mockResolvedValueOnce({
                    "my_rule": { name: "My Rule", status: "mock status" } as RulesV1ResponseItem
                });
                let resources = bridgeConfigNode.getAllResources();
                return expect(resources).resolves.toContainEqual(expect.objectContaining({
                    name: "My Rule",
                    type: "rule",
                    id: "rule_my_rule",
                    id_v1: "/rules/my_rule",
                    status: "mock status"
                }));
            });
            it("should include device resources in the results", () => {
                jest.mocked(API.getAllResources).mockResolvedValueOnce([
                    { id: "my_device", type: "device" }
                ])
                let resources = bridgeConfigNode.getAllResources();
                return expect(resources).resolves.toContainEqual(expect.objectContaining({
                    id: "my_device", type: "device"
                }));
            });
            it("should contain everything as fetched from the API", async () => {
                // Integration test
                let resources = await bridgeConfigNode.getAllResources();
                expect(resources).toContainEqual(expect.objectContaining(defaultBridgeConfig))
                Object.entries(defaultRules).forEach(([id, rule]) => {
                    expect(resources).toContainEqual(expect.objectContaining({
                        ...rule,
						id: `rule_${id}`,
						id_v1: `/rules/${id}`,
                        type: "rule"
                    }))
                });
                defaultResources.forEach((resource) => {
                    expect(resources).toContainEqual(expect.objectContaining(resource))
                });
            });
            it("should be true that all entries have id, id_v1, and type", async () => {
                let resources = await bridgeConfigNode.getAllResources();
                resources.forEach((resource) => {
                    expect(resource).toHaveProperty("id");
                    expect(resource).toHaveProperty("id_v1");
                    expect(resource).toHaveProperty("type");
                });
            });
            it("should reject on API failure", () => {
                jest.mocked(API.config).mockRejectedValueOnce("error message");
                const result = expect(bridgeConfigNode.getAllResources()).rejects.toEqual("error message");
                return result;
            });
        });

        describe(HueBridgeConfig.prototype.pushUpdatedState, () => {
            const msg = {
                id: "my_resource",
                type: "device",
                updatedType: "device",
                services: [],
                suppressMessage: false
            };
            beforeAll(() => {
                EventEmitter.mockReset();
            });
            afterEach(() => {
                EventEmitter.mockReset();
            })

            const mockEmit = () => {
                expect(EventEmitter.mock.instances.length).toBe(1);
                const events = EventEmitter.mock.instances[0];
                const emit = jest.mocked(events.emit);
                emit.mockReturnValue(true); // noop events
                return emit;
            }

            it("should emit events for updated resources", () => {
                const resource: ExpandedResource<"device"> = {
                    id: "my_resource",
                    type: "device"
                }

                const emit = mockEmit();
                bridgeConfigNode.pushUpdatedState(resource, "device");

                expect(emit).toBeCalledTimes(2);
                expect(emit).toBeCalledWith("bridge_my_resource", msg);
                expect(emit).toBeCalledWith("bridge_globalResourceUpdates", msg);
            });
            it("should set suppressMessage in the generated message", () => {
                const resource: ExpandedResource<"device"> = {
                    id: "my_resource",
                    type: "device"
                }

                const emit = mockEmit();
                bridgeConfigNode.pushUpdatedState(resource, "device");
                expect(emit.mock.calls).toEqual([
                    [ expect.anything(), expect.objectContaining({ suppressMessage: false }) ],
                    [ expect.anything(), expect.objectContaining({ suppressMessage: false }) ],
                ])

                emit.mockClear();
                bridgeConfigNode.pushUpdatedState(resource, "device", true);
                expect(emit.mock.calls).toEqual([
                    [ expect.anything(), expect.objectContaining({ suppressMessage: true }) ],
                    [ expect.anything(), expect.objectContaining({ suppressMessage: true }) ],
                ])
            })
            describe("if the resource has services", () => {
                it("should include services in the messages", () => {
                    const resource: ExpandedServiceOwnerResource<"device"> = {
                        id: "my_resource",
                        type: "device",
                        services: {
                            "button": { "my_button": { id: "my_button", type: "button" } },
                            "device": { "my_device": { id: "my_device", type: "device" } }
                        }
                    };
                    const emit = mockEmit();
                    bridgeConfigNode.pushUpdatedState(resource, "device");

                    const serviceMsg = {
                        ...msg,
                        services: expect.arrayContaining(["my_button", "my_device"])
                    };
                    
                    expect(emit).toBeCalledTimes(2);
                    expect(emit).toBeCalledWith("bridge_my_resource", serviceMsg);
                    expect(emit).toBeCalledWith("bridge_globalResourceUpdates", serviceMsg);
                });
                it("should emit changes to groups if services are members of a group", () => {
                    const resource: ExpandedServiceOwnerResource<"device"> = {
                        id: "my_resource",
                        type: "device",
                        services: {
                            "button": { "my_button": { id: "my_button", type: "button" } },
                            "device": { "my_device": { id: "my_device", type: "device" } }
                        }
                    };

                    bridgeConfigNode.groupsOfResources["my_resource"] = [ "zone_id" ];

                    const groupMsg = {
                        id: "zone_id",
                        type: "group",
                        updatedType: "device",
                        services: [],
                        suppressMessage: false
                    };

                    const emit = mockEmit();
                    bridgeConfigNode.pushUpdatedState(resource, "device");

                    expect(emit).toBeCalledTimes(4);
                    expect(emit).nthCalledWith(3, "bridge_zone_id", groupMsg);
                    expect(emit).nthCalledWith(4, "bridge_globalResourceUpdates", groupMsg);
                });
            });
        });

        describe(HueBridgeConfig.prototype.emitInitialStates, () => {
            it("should not do anything on the current tick", async () => {
                jest.useFakeTimers();
                const pushStateMock = jest.spyOn(bridgeConfigNode, "pushUpdatedState")
                pushStateMock.mockReturnValue();

                bridgeConfigNode.resources["my_resource"] = {
                    id: "my_resource",
                    type: "device",
                };

                // Don't emit events immediately
                const promise = bridgeConfigNode.emitInitialStates();
                expect(pushStateMock).not.toBeCalled();

                // But do in the next event loop
                jest.runAllTimers();
                await promise;
                expect(pushStateMock).toBeCalled();

                
                jest.clearAllTimers();
                jest.useRealTimers();
            })
            it("should emit an event for every resource", () => {
                    jest.useFakeTimers();
                    const pushStateMock = jest.spyOn(bridgeConfigNode, "pushUpdatedState")
                    pushStateMock.mockReturnValue();
                    const r1: ExpandedResource<"device"> = {
                        id: "my_resource1",
                        type: "device",
                    };
                    const r2: ExpandedResource<"device"> = {
                        id: "my_resource1",
                        type: "device",
                    };
                    bridgeConfigNode.resources["my_resource1"] = r1;
                    bridgeConfigNode.resources["my_resource2"] = r2;

                    const promise = bridgeConfigNode.emitInitialStates();
                    jest.runAllTimers();

                    expect(pushStateMock).toBeCalledTimes(2);
                    expect(pushStateMock.mock.calls).toContainEqual([ r1, "device", true ]);
                    expect(pushStateMock.mock.calls).toContainEqual([ r2, "device", true ]);
                    
                    jest.clearAllTimers();
                    jest.useRealTimers();

                    return promise;
            });
        });

        describe(HueBridgeConfig.prototype.subscribeToBridgeEventStream, () => {
            it("should subscribe to bridge events", () => {
                jest.mocked(API.subscribe).mockReturnValueOnce(Promise.resolve(true));
                bridgeConfigNode.subscribeToBridgeEventStream();
                expect(API.subscribe).toBeCalledWith(config, bridgeConfigNode.handleBridgeEvent);
            });
        });
        describe(HueBridgeConfig.prototype.handleBridgeEvent, () => {
            beforeEach(() => {
                jest.spyOn(bridgeConfigNode, "pushUpdatedState").mockReturnValue();
            });
            it("shouldn't update state or events if the event contains no new info", () => {
                const event = makeEvent("my_event", "update", makeDevice("new_device"));
                const resources = { ...bridgeConfigNode.resources };

                bridgeConfigNode.handleBridgeEvent([ event ]);
                
                expect(bridgeConfigNode.pushUpdatedState).not.toBeCalled();
                expect(bridgeConfigNode.resources).toEqual(resources);
            });
            it("should do nothing for events with no differences", () => {
                const device = makeDevice("new_device");
                bridgeConfigNode.resources[device.id] = device;
                const event = makeEvent("my_event", "update", device);
                const resources = { ...bridgeConfigNode.resources };

                bridgeConfigNode.handleBridgeEvent([ event ]);

                expect(bridgeConfigNode.pushUpdatedState).not.toBeCalled();
                expect(bridgeConfigNode.resources).toEqual(resources);
            });
            it("should update the eventing resource and send an event for an unowned resource", () => {
                const now = dayjs();

                const device = makeDevice("new_device", "Old Name");
                bridgeConfigNode.resources[device.id] = device;
                const event = makeEvent("my_event", "update", {
                    ...device,
                    metadata: { ...device.metadata, name: "Something New" }
                });

                dayjs.mockReturnValueOnce(now);
                bridgeConfigNode.handleBridgeEvent([ event ]);

                expect(bridgeConfigNode.pushUpdatedState).toBeCalled();
                expect(bridgeConfigNode.resources).toEqual({
                    new_device: expect.objectContaining({
                        metadata: expect.objectContaining({ name: "Something New" }),
                        updated: now.format()
                    })
                });
            });
            describe("if the eventing resource has a parent", () => {
                const putExpandedResources = (bridge: HueBridgeConfig, ...resources: Resource<any>[]) => {
                    const [expanded, grouped] = expandedResources(resources);
                    Object.entries(expanded).forEach(([id, res]) => bridge.resources[id] = res);
                    Object.entries(grouped).forEach(([id, grp]) => bridge.groupsOfResources[id] = grp);
                }
                it("should error if the parent doesn't exist", () => {
                    const device = makeLight("my_light", "Something Old", {
                        rid: "this_doesn't_exist",
                        rtype: "device"
                    });
                    
                    bridgeConfigNode.resources[device.id] = device;
                    const event = makeEvent("my_event", "update", {
                        ...device,
                        metadata: { ...device.metadata, name: "Something New" }
                    });
                    expect(() => bridgeConfigNode.handleBridgeEvent([ event ])).toThrowError(/No resource entry/);
                });
                it("should notify the parent, not the resource directly", () => {
                    const [ group, buttons ] = makeButtonGroup("Button Group", 4);
                    putExpandedResources(bridgeConfigNode, group, ...buttons);

                    const button = buttons[0];
                    const event = makeEvent("my_event", "update", {
                        ...button,
                        button: { last_event: "initial_press" }
                    });
                    
                    bridgeConfigNode.handleBridgeEvent([ event ]);
                    expect(bridgeConfigNode.pushUpdatedState).toBeCalledTimes(1);
                    expect(bridgeConfigNode.pushUpdatedState).toBeCalledWith(expect.objectContaining({
                        id: group.id,
                        services: expect.objectContaining({
                            button: expect.objectContaining({
                                [buttons[0].id]: expect.anything(),
                                [buttons[1].id]: expect.anything(),
                                [buttons[2].id]: expect.anything(),
                                [buttons[3].id]: expect.anything(),
                            })
                        })
                    }), "button");
                });
                it("should keep only the pressed button state and clear others off the parent if it's a button", () => {
                    const [ group, buttons ] = makeButtonGroup("Button Group", 4);
                    buttons.forEach((btn) => { btn.button = { last_event: "initial_press" }; })
                    putExpandedResources(bridgeConfigNode, group, ...buttons);

                    const button = buttons[0];
                    const event = makeEvent("my_event", "update", {
                        ...button,
                        button: { last_event: "short_release"}
                    });
                    
                    bridgeConfigNode.handleBridgeEvent([ event ]);
                    expect(bridgeConfigNode.pushUpdatedState).toBeCalledTimes(1);
                    let expandedGroup = bridgeConfigNode.resources[group.id] as ExpandedServiceOwnerResource<"device">;
                    expect(bridgeConfigNode.pushUpdatedState).toBeCalledWith(expandedGroup, "button");
                    
                    expect(expandedGroup.services?.button).toEqual(expect.objectContaining({
                        [buttons[0].id]: expect.objectContaining({ button: { last_event: "short_release" } }),
                        [buttons[1].id]: expect.not.objectContaining({ button: expect.anything() }),
                        [buttons[2].id]: expect.not.objectContaining({ button: expect.anything() }),
                        [buttons[3].id]: expect.not.objectContaining({ button: expect.anything() }),
                    }))
                });
                it("should warn but continue if this doesn't seem like an expected owned type", () => {
                    jest.spyOn(console, "warn").mockReturnValueOnce();
                    const [ group, buttons ] = makeButtonGroup("Button Group", 4);
                    putExpandedResources(bridgeConfigNode, group, ...buttons);

                    bridgeConfigNode.resources[group.id].type = "motion";
                    
                    const button = buttons[0];
                    const event = makeEvent("my_event", "update", {
                        ...button,
                        button: { last_event: "short_release" }
                    });
                    bridgeConfigNode.handleBridgeEvent([ event ]);
                    expect(bridgeConfigNode.pushUpdatedState).toBeCalledTimes(1);

                    expect(console.warn).toBeCalledWith(expect.stringContaining("not an expected owner type"));

                    let expandedGroup = bridgeConfigNode.resources[group.id] as ExpandedServiceOwnerResource<ServiceOwnerResourceType>; // This is a lie; it's a "motion"
                    expect(expandedGroup.services?.button).toEqual(expect.objectContaining({
                        [buttons[0].id]: expect.objectContaining({ button: { last_event: "short_release" } }),
                        [buttons[1].id]: expect.not.objectContaining({ button: expect.anything() }),
                        [buttons[2].id]: expect.not.objectContaining({ button: expect.anything() }),
                        [buttons[3].id]: expect.not.objectContaining({ button: expect.anything() }),
                    }))
                });
            });
        });

        describe(HueBridgeConfig.prototype.keepUpdated, () => {
            it("should do nothing if updates are disabled", () => {
                bridgeConfigNode = new HueBridgeConfig(node, {
                    ...config,
                    disableupdates: true
                }, RED);
                jest.spyOn(bridgeConfigNode, "subscribeToBridgeEventStream").mockReturnValue();
                bridgeConfigNode.keepUpdated();
                expect(bridgeConfigNode.subscribeToBridgeEventStream).not.toBeCalled();
            });
            it("should subscribe to events if not disabled", () => {
                jest.spyOn(bridgeConfigNode, "subscribeToBridgeEventStream").mockReturnValue();
                bridgeConfigNode.keepUpdated();
                expect(bridgeConfigNode.subscribeToBridgeEventStream).toBeCalled();
            });
        });

        describe(HueBridgeConfig.prototype.autoUpdateFirmware, () => {
            beforeEach(() => {
                jest.mocked(API.setBridgeUpdate).mockClear();
            });
            it("should do nothing if config.autoupdates === false", () => {
                bridgeConfigNode = new HueBridgeConfig(node, { ...config, autoupdates: false }, RED);
                const promise = bridgeConfigNode.autoUpdateFirmware();
                expect(jest.mocked(API.setBridgeUpdate)).not.toBeCalled();
                return promise;
            });
            it("should make an API call to update firmware if config.autoupdates === true", () => {
                bridgeConfigNode = new HueBridgeConfig(node, { ...config, autoupdates: true }, RED);
                const promise = bridgeConfigNode.autoUpdateFirmware();
                expect(jest.mocked(API.setBridgeUpdate)).toBeCalled();
                return promise;
            });
            it("should make an API call to update firmware if config.autoupdates === undefined", () => {
                bridgeConfigNode = new HueBridgeConfig(node, { ...config, autoupdates: undefined }, RED);
                const promise = bridgeConfigNode.autoUpdateFirmware();
                expect(jest.mocked(API.setBridgeUpdate)).toBeCalled();
                return promise;
            });

            it("should warn and retry failure", async () => {
                jest.useFakeTimers();
                mockInstantTimeout();
                const error = { error: { type: 1, address: "example", description: "error message" } };
                jest.mocked(API.setBridgeUpdate).mockRejectedValueOnce([ error ]);

                // Mock .autoUpdateFirmware to just resolve(true) after running the first time
                const mockAutoUpdateFirmware = mockRunMethodOnceAndThenNoop(bridgeConfigNode, "autoUpdateFirmware");

                // Trigger an error so we retry
                await bridgeConfigNode.autoUpdateFirmware();
                expect(mockAutoUpdateFirmware).toBeCalledTimes(2);
                expect(nodeWarn).toBeCalledTimes(2);
                expect(nodeWarn).toBeCalledWith(expect.stringContaining("Error response"));
                expect(nodeWarn).toBeCalledWith("error message");

                // It should also have started tracking the timeout
                expect(bridgeConfigNode.firmwareUpdateTimeout).not.toBeUndefined();

                jest.useRealTimers();
            });
            it("should not retry if not enabled", () => {
                bridgeConfigNode.enabled = false;
                const error = { error: { type: 1, address: "example", description: "error message" } };
                jest.mocked(API.setBridgeUpdate).mockRejectedValueOnce([ error ]);
                const result = expect(bridgeConfigNode.autoUpdateFirmware()).resolves.toBe(false);
                return result;
            });
            it("should schedule a retry for 12 hours later on success", async () => {
                jest.useFakeTimers();
                mockInstantTimeout();

                const mockAutoUpdateFirmware = mockRunMethodOnceAndThenNoop(bridgeConfigNode, "autoUpdateFirmware");

                await bridgeConfigNode.autoUpdateFirmware();
                expect(setTimeout).toBeCalledWith(expect.anything(), 12*3600*1000);
                expect(mockAutoUpdateFirmware).toBeCalledTimes(2);

                // It should also have started tracking the timeout
                expect(bridgeConfigNode.firmwareUpdateTimeout).not.toBeUndefined();

                jest.clearAllTimers();
                jest.useRealTimers();
            });
            it("should clear any existing update timers", async () => {
                jest.useFakeTimers();
                mockInstantTimeout();

                const orig = bridgeConfigNode.autoUpdateFirmware;
                const mockAutoUpdateFirmware = jest.spyOn(bridgeConfigNode, "autoUpdateFirmware");

                // Run once to set firmwareUpdateTimeout
                mockAutoUpdateFirmware.mockImplementationOnce(orig);
                mockAutoUpdateFirmware.mockResolvedValueOnce(true);
                await bridgeConfigNode.autoUpdateFirmware();
                expect(setTimeout).toBeCalledWith(expect.anything(), 12*3600*1000);
                expect(mockAutoUpdateFirmware).toBeCalledTimes(2);
                let timeout = bridgeConfigNode.firmwareUpdateTimeout;
                expect(timeout).not.toBeUndefined();

                // Run again to prove we call clearTimeout
                jest.spyOn(global, "clearTimeout").mockClear();
                mockAutoUpdateFirmware.mockImplementationOnce(orig);
                mockAutoUpdateFirmware.mockResolvedValueOnce(true);
                await bridgeConfigNode.autoUpdateFirmware();
                expect(clearTimeout).toHaveBeenCalledTimes(1);
                expect(clearTimeout).toHaveBeenCalledWith(timeout)

                jest.clearAllTimers();
                jest.useRealTimers();
            });
        });
    });

    describe(HueBridgeConfig.prototype.subscribe, () => {
        let bridgeConfigNode!: HueBridgeConfig;
        beforeEach(() => {
            EventEmitter.mockReset();
            EventEmitter.mockImplementation((...args) => new OrigEventEmitter(...args))
            bridgeConfigNode = new HueBridgeConfig(node, config, RED);
        });
        afterEach(() => {
            EventEmitter.mockReset();
        })
        const updateEvent: UpdatedResourceEvent = {
            id: randomUUID(),
            type: "light",
            updatedType: "" as ResourceType,
            services: [],
            suppressMessage: false
        };
        it("should forward any events if subscribed with the 'bridge' type and no ID", () => {
            const mockCb = jest.fn();
            bridgeConfigNode.subscribe("bridge", mockCb);
            bridgeConfigNode.events.emit(
                `bridge_globalResourceUpdates`,
                { ...updateEvent, updatedType: "test" as ResourceType }
            );
            expect(mockCb).toBeCalledWith(expect.objectContaining({ ...updateEvent, updatedType: "test" }));
        });

        function emitEventWithUpdatedType(serviceType: ResourceType, updatedType: ResourceType) {
            bridgeConfigNode.events.emit(
                "bridge_globalResourceUpdates", {
                    ...updateEvent,
                    services: [serviceType],
                    updatedType
                }
            );
        }
        it("should not forward events of other types", () => {
            const mockCb = jest.fn();
            bridgeConfigNode.subscribe("light", mockCb);
            emitEventWithUpdatedType("motion", "motion");
            expect(mockCb).not.toBeCalled();
        })
        it("should forward light events of type light, zigbee_connectivity, zgp_connectivity, device", () => {
            const mockCb = jest.fn();
            bridgeConfigNode.subscribe("light", mockCb);
            const rTypes: ResourceType[] = [ "light", "zigbee_connectivity", "zgp_connectivity", "device" ];
            rTypes.forEach((updateType) => { emitEventWithUpdatedType("light", updateType); });
            expect(mockCb).toBeCalledWith(expect.objectContaining({ updatedType: "light" }));
            expect(mockCb).toBeCalledWith(expect.objectContaining({ updatedType: "zigbee_connectivity" }));
            expect(mockCb).toBeCalledWith(expect.objectContaining({ updatedType: "zgp_connectivity" }));
            expect(mockCb).toBeCalledWith(expect.objectContaining({ updatedType: "device" }));
        });
        it("should forward motion events of type motion, zigbee_connectivity, zgp_connectivity, device_power, device", () => {
            const mockCb = jest.fn();
            bridgeConfigNode.subscribe("motion", mockCb);
            const rTypes: ResourceType[] = [ "motion", "zigbee_connectivity", "zgp_connectivity", "device_power", "device" ];
            rTypes.forEach((updateType) => { emitEventWithUpdatedType("motion", updateType); });
            expect(mockCb).toBeCalledWith(expect.objectContaining({ updatedType: "motion" }));
            expect(mockCb).toBeCalledWith(expect.objectContaining({ updatedType: "zigbee_connectivity" }));
            expect(mockCb).toBeCalledWith(expect.objectContaining({ updatedType: "zgp_connectivity" }));
            expect(mockCb).toBeCalledWith(expect.objectContaining({ updatedType: "device_power" }));
            expect(mockCb).toBeCalledWith(expect.objectContaining({ updatedType: "device" }));
        });
        // TODO: The other types?
        it("should not forward events of unknown types", () => {
            const mockCb = jest.fn();
            bridgeConfigNode.subscribe("light", mockCb);
            bridgeConfigNode.events.emit(
                "bridge_globalResourceUpdates", {
                    ...updateEvent,
                    services: ["light"],
                    updatedType: "test" as ResourceType
                }
            );
            expect(mockCb).not.toBeCalled();
        })
        it("should forward rule events of type rule", () => {
            const mockCb = jest.fn();
            bridgeConfigNode.subscribe("rule", mockCb);
            bridgeConfigNode.events.emit(
                "bridge_globalResourceUpdates", { ...updateEvent, updatedType: "rule" }
            );
            expect(mockCb).toBeCalledWith(expect.objectContaining({ ...updateEvent, updatedType: "rule" }));
        })
        it.todo("should forward all device-specific events if subscribed with type bridge");
        it.todo("should forward events of a specific type for a given ID");
        it.todo("should not forward events for devices with other IDs");
        it.todo("should not forward events for devices with other types");
    });
});
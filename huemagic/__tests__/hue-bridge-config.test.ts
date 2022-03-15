jest.mock("node-red");
jest.mock("../utils/api");

import * as NodeRed from "node-red";
import * as registry from "@node-red/registry";
import { HueBridge, HueBridgeDef } from "../hue-bridge-config";

import API from "../utils/api";
import { defaultBridgeConfig } from "../utils/__fixtures__/api/config";
import { Bridge } from "../utils/types/api/bridge";
import { RulesV1Response, RulesV1ResponseItem } from "../utils/types/api/rules";
import { defaultRules } from "../utils/__fixtures__/api/rules";
import { defaultResources } from "../utils/__fixtures__/api/resources";


const nodeCreate = jest.fn();
const nodeApiLog = jest.fn().mockName("nodeApiLog");
const nodeLog = jest.fn().mockName("nodeLog");

const RED: NodeRed.NodeAPI = {
    nodes: {
        createNode: nodeCreate
    } as unknown as registry.NodeAPINodes,
    log: nodeApiLog as unknown as registry.NodeApiLog,
} as unknown as NodeRed.NodeAPI;
const node: NodeRed.Node = {
    log: nodeLog
} as unknown as NodeRed.Node;


const BRIDGE = "bridge-" + Math.random();
const BRIDGE_KEY = "key-" + Math.random();
const config: HueBridgeDef = {
    bridge: BRIDGE,
    key: BRIDGE_KEY,
    id: "bridge",
    type: "bridge",
    name: "my bridge",
    z: "wat"
}
function mockInstantTimeout() {
    jest.useFakeTimers();
    const origTimeout = setTimeout;
    const mockTimeout = jest.spyOn(global, "setTimeout").mockImplementation(
        (cb, ms) => {
            const t = setImmediate(cb);
            jest.runAllTimers();
            return t as unknown as NodeJS.Timeout;
        }
    );
    return mockTimeout;
}

describe(HueBridge, () => {
    beforeEach(() => {
        nodeCreate.mockClear();
        nodeLog.mockClear();
    });
    it("should be constructable", () => {
        new HueBridge(RED, node, config);
        expect(nodeCreate).toBeCalledTimes(1);
        expect(nodeCreate).toBeCalledWith(node, config);
    });

    describe("after construction", () => {
        let bridgeNode = new HueBridge(RED, node, config);
        beforeEach(() => {
            bridgeNode = new HueBridge(RED, node, config);
        });

        describe(bridgeNode.start, () => {
            it("should retry a connection on connection failure", async () => {
                jest.useFakeTimers();
                const mockTimeout = mockInstantTimeout();

                // Mock .start to just resolve(true) after running the first time
                const origStart = bridgeNode.start;
                const mockStart = jest.spyOn(bridgeNode, "start");
                mockStart.mockImplementationOnce(origStart);
                mockStart.mockResolvedValueOnce(true);

                // Trigger an error so we retry
                jest.mocked(API.init).mockRejectedValueOnce("error message");

                await bridgeNode.start();
                expect(nodeLog).toBeCalledTimes(2);
                expect(nodeLog).toBeCalledWith("error message");

                jest.useRealTimers();
            });
            it("should not rety when the node is disabled", () => {
                bridgeNode.enabled = false;
                jest.mocked(API.init).mockRejectedValueOnce("error message");
                const result = expect(bridgeNode.start()).resolves.toBe(false);
                return result;
            })
        })

        describe(bridgeNode.getBridgeInformation, () => {
            it("should fetch and generate a bridge config", () => {
                return expect(bridgeNode.getBridgeInformation()).resolves.toEqual(expect.objectContaining({
                    ...defaultBridgeConfig,
                    id: "bridge",
                    id_v1: "/config",
                    type: "bridge",
                    updated: expect.stringMatching(/.*T.*/)
                }));
            });
            it("should not replace the bridge entry if replaceResources is true", async () => {
                await bridgeNode.getBridgeInformation();
                expect(bridgeNode.resources["bridge"]).toBeUndefined();
            });
            it("should replace the bridge entry if replaceResources is true", async () => {
                await bridgeNode.getBridgeInformation(true);
                expect(bridgeNode.resources["bridge"]).toEqual(expect.objectContaining({
                    type: "bridge",
                    id: "bridge"
                }));
            });
            it("should reject on API failure", () => {
                jest.mocked(API.config).mockRejectedValueOnce("error message");
                const result = expect(bridgeNode.getBridgeInformation()).rejects.toEqual("error message");
                return result;
            });
        });
        describe(bridgeNode.getAllResources, () => {
            it("should include the bridge in the results", () => {
                jest.spyOn(bridgeNode, "getBridgeInformation").mockImplementation(() => {
                    return Promise.resolve({ type: "bridge", id: "mockBridge" }) as Promise<Bridge>;
                });
                let resources = bridgeNode.getAllResources();
                return expect(resources).resolves.toContainEqual(expect.objectContaining({
                    id: "mockBridge",
                    type: "bridge"
                }));
            });
            it("should include rules in the results", () => {
                jest.mocked(API.rules).mockResolvedValueOnce({
                    "my_rule": { name: "My Rule", status: "mock status" } as RulesV1ResponseItem
                });
                let resources = bridgeNode.getAllResources();
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
                let resources = bridgeNode.getAllResources();
                return expect(resources).resolves.toContainEqual(expect.objectContaining({
                    id: "my_device", type: "device"
                }));
            });
            it("should contain everything as fetched from the API", async () => {
                // Integration test
                let resources = await bridgeNode.getAllResources();
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
                let resources = await bridgeNode.getAllResources();
                resources.forEach((resource) => {
                    expect(resource).toHaveProperty("id");
                    expect(resource).toHaveProperty("id_v1");
                    expect(resource).toHaveProperty("type");
                });
            });
            it("should reject on API failure", () => {
                jest.mocked(API.config).mockRejectedValueOnce("error message");
                const result = expect(bridgeNode.getAllResources()).rejects.toEqual("error message");
                return result;
            });
        });
    });

});
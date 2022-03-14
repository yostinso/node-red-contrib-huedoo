jest.mock("node-red");

import * as NodeRed from "node-red";
import * as registry from "@node-red/registry";
import { HueBridge, HueBridgeDef } from "../hue-bridge-config";

import API from "../utils/api";
import { promise } from "fastq";
import { start } from "repl";
import { callbackify } from "util";
jest.mock("../utils/api");

const nodeCreate = jest.fn();
const nodeApiLog = jest.fn().mockName("nodeApiLog");
const nodeLog = jest.fn().mockName("nodeLog");

const nodeRed = jest.createMockFromModule("node-red") as jest.Mocked<NodeRed.NodeRedApp>;

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
                API.init = jest.fn().mockRejectedValueOnce("error message");

                await bridgeNode.start();
                expect(nodeLog).toBeCalledTimes(2);
                expect(nodeLog).toBeCalledWith("error message");

                mockTimeout.mockRestore();
                jest.useRealTimers();
            });
        })
    });

});
jest.mock("../utils/api");
jest.mock("node-red");

import * as NodeRed from "node-red";
import * as registry from "@node-red/registry";
import { HueBridge, HueBridgeDef } from "../hue-bridge-config";

const nodeCreate = jest.fn();
const nodeApiLog = jest.fn();
const nodeLog = jest.fn();

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

describe(HueBridge, () => {
    it("should be constructable", () => {
        new HueBridge(RED, node, config);
        expect(nodeCreate).toBeCalledTimes(1);
        expect(nodeCreate).toBeCalledWith(node, config);
    })

});
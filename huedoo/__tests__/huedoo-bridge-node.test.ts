jest.mock("node-red");
import { Node, NodeAPI } from "node-red";
import { HueBridgeConfig, HueBridgeDef } from "../huedoo-bridge-config";
import { HueBridgeNode } from "../huedoo-bridge-node";

/* Set up bridge */
const BRIDGE = "bridge-" + Math.random();
const BRIDGE_KEY = "key-" + Math.random();
const bridgeNode: Node = {
    log: jest.fn(),
    warn: jest.fn()
} as unknown as Node;
const bridgeConfig: HueBridgeDef = {
    bridge: BRIDGE,
    key: BRIDGE_KEY,
    id: "bridge",
    type: "hue-bridge-config",
    name: "my bridge",
    z: "wat"
}
const RED_getNode = jest.fn().mockImplementation((nodeId: string): Node | null => {
    if (nodeId == BRIDGE) {
        return new HueBridgeConfig(bridgeNode, bridgeConfig, RED);
    } else {
        return null;
    }
});
const RED: NodeAPI = { nodes: { getNode: RED_getNode } } as unknown as NodeAPI;

/* Set up node */
const nodeLog = jest.fn().mockName("nodeLog");
const nodeWarn = jest.fn().mockName("nodeWarn");
const nodeStatus = jest.fn().mockName("nodeStatus");
const nodeOn = jest.fn().mockName("nodeOn");
const node: Node = {
    log: nodeLog,
    warn: nodeWarn,
    status: nodeStatus,
    on: nodeOn

} as unknown as Node;


const config: HueBridgeDef = {
    bridge: BRIDGE,
    key: `${BRIDGE_KEY}-node`,
    id: "bridge-node",
    type: "hue-bridge-node",
    name: "my bridge",
    z: "wat"
}

describe(HueBridgeNode, () => {
    beforeEach(() => {
        nodeLog.mockClear();
        nodeWarn.mockClear();
        nodeStatus.mockClear();
    });
    it("should be constructable", () => {
        expect(() => new HueBridgeNode(node, config, RED)).not.toThrow();
    });
    it("should set the status to red when no bridge provided", () => {
        jest.mocked(RED.nodes.getNode).mockReturnValueOnce(null as unknown as Node);
        const hueBridge = new HueBridgeNode(node, config, RED);
        expect(nodeStatus).toBeCalledWith(expect.objectContaining({ fill: "red" }));
    });
    it("should set the status to grey while connecting", () => {
        new HueBridgeNode(node, config, RED);
        expect(nodeStatus).toBeCalledWith(expect.objectContaining({ fill: "grey" }));
    });
    it("should subscribe to bridge events on construction", () => {
        const subscribeToBridgeMock = jest.spyOn(HueBridgeNode.prototype, "subscribeToBridge");
        const bridgeNode = new HueBridgeNode(node, config, RED);
        expect(subscribeToBridgeMock).toBeCalled();
        expect(nodeOn).toBeCalledWith("input", bridgeNode.handleMessage);
        subscribeToBridgeMock.mockReset();
    })
    /*
    describe("after construction", () => {
        let bridgeNode!: HueBridgeNode;
        beforeEach(() => {
            bridgeNode = new HueBridgeNode(node, config, RED);
        });
    });
    */
});
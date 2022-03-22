import hueBridgeNodeRegister, { HueBridgeNode } from "../huedoo-bridge-node";
import nodeTestHelper from "node-red-node-test-helper";

describe(HueBridgeNode, () => {
    it("should be loadable", () => {
        const flow = [{
            id: "n1", type: "huedoo-bridge-node", name: "test bridge node"
        }]
        return nodeTestHelper.load(hueBridgeNodeRegister, flow, () => {
            const hueBridgeNode = nodeTestHelper.getNode("n1") as HueBridgeNode;
            expect(hueBridgeNode).toHaveProperty("name", "test bridge node");
            expect(hueBridgeNode).toHaveProperty("enabled", true);
        })
    })
});
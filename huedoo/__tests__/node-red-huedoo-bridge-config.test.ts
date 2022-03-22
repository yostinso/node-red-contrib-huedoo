import hueBridgeRegister, { HueBridgeConfig } from "../huedoo-bridge-config";
import nodeTestHelper from "node-red-node-test-helper";

describe(HueBridgeConfig, () => {
    it("should be loadable", () => {
        const flow = [{
            id: "n1", type: "huedoo-bridge-config", name: "test bridge"
        }]
        return nodeTestHelper.load(hueBridgeRegister, flow, () => {
            const hueBridge = nodeTestHelper.getNode("n1") as HueBridgeConfig;
            expect(hueBridge).toHaveProperty("name", "test bridge");
            expect(hueBridge).toHaveProperty("enabled", true);
        })
    })
});
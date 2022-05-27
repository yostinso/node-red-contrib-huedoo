import NodeRedNode from "./ES6Node"
import * as NodeRed from "node-red";
import util from "util";
import { HueBridgeConfig, HueBridgeDef } from "./huedoo-bridge-config";

export class HueBridgeNode extends NodeRedNode {
    private readonly config: HueBridgeDef;
    private readonly RED: NodeRed.NodeAPI;
	private readonly bridge?: HueBridgeConfig;

    constructor(node: NodeRed.Node, config: HueBridgeDef, RED: NodeRed.NodeAPI) {
		super(node); // become a Node!
        this.config = config;
		this.RED = RED;
		const bridge = RED.nodes.getNode(config.bridge);
		if (bridge instanceof HueBridgeConfig) {
			this.bridge = bridge;
			this.init();
		} else if (bridge === undefined || bridge === null) {
			this.status({fill: "red", shape: "ring", text: "huedoo-bridge-node.node.not-configured"});
		} else {
			throw new Error(`Wrong kind of bridge config! ${bridge}`);
		}
	}

	init() {
		this.status({ fill: "grey", shape: "dot", text: "huedoo-bridge-node.node.connecting" });
	}
}

module.exports = function (RED: NodeRed.NodeAPI) {
    function MakeNode2(this: NodeRed.Node, config: HueBridgeDef) {
        RED.nodes.createNode(this, config);
        util.inherits(HueBridgeNode, this.constructor);
        return new HueBridgeNode(this, config, RED);
    }
	RED.nodes.registerType(
		"huedoo-bridge-node",
		MakeNode2
	)
}

export default module.exports;
module.exports.HueBridgeNode = HueBridgeNode;
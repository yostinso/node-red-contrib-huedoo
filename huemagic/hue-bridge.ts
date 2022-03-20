import NodeRedNode from "./ES6Node";
import * as NodeRed from "node-red";
import { HueBridgeDef } from "./hue-bridge-config";

class HueBridge extends NodeRedNode {
    private readonly config: HueBridgeDef;
	private readonly RED: NodeRed.NodeAPI;

    constructor(node: NodeRed.Node, config: HueBridgeDef, RED: NodeRed.NodeAPI) {
		super(node); // become a Node!
        this.config = config;
		this.RED = RED;

		//this.init();
	}

}

export default function (RED: NodeRed.NodeAPI) {
	RED.nodes.registerType(
		"hue-bridge-config",
		function (this: NodeRed.Node, config: HueBridgeDef) {
			RED.nodes.createNode(this, config);
			return new HueBridge(this, config, RED);
		}
	)
}
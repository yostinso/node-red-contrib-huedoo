import NodeRedNode from "./ES6Node"
import * as NodeRed from "node-red";
import util from "util";

export interface HueBridgeDef extends NodeRed.NodeDef {
	autoupdates?: boolean;
	disableupdates?: boolean;
	bridge: string;
	key: string;
}

export class HueBridgeConfig extends NodeRedNode {
    private readonly config: HueBridgeDef;
    private readonly RED: NodeRed.NodeAPI;

    constructor(node: NodeRed.Node, config: HueBridgeDef, RED: NodeRed.NodeAPI) {
		super(node); // become a Node!
        this.config = config;
		this.RED = RED;

		//this.init();
	}
}

module.exports = function (RED: NodeRed.NodeAPI) {
    function MakeNode2(this: NodeRed.Node, config: HueBridgeDef) {
        RED.nodes.createNode(this, config);
        util.inherits(HueBridgeConfig, this.constructor);
        return new HueBridgeConfig(this, config, RED);
    }
	RED.nodes.registerType(
		"huedoo-bridge-config",
		MakeNode2
	)
}

export default module.exports;
module.exports.HueBridgeConfig = HueBridgeConfig;
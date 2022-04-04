import * as NodeRed from "node-red";
import util from "util";
import NodeRedNode from "./ES6Node";
import { HueBridgeConfig, HueBridgeDef } from "./huedoo-bridge-config";
import { Bridge } from "./utils/types/api/bridge";

export class HueBridgeNode extends NodeRedNode {
    private readonly config: HueBridgeDef;
	private readonly RED: NodeRed.NodeAPI;
    private readonly bridge?: HueBridgeConfig;
	public enabled: boolean = true;
    private _lastBridgeInformation?: Bridge;
    public get lastBridgeInformation() { return this._lastBridgeInformation; }
    // lastCommand
    // timeout
    // 

    constructor(node: NodeRed.Node, config: HueBridgeDef, RED: NodeRed.NodeAPI) {
		super(node); // become a Node!
        this.config = config;
		this.RED = RED;

        const bridge = RED.nodes.getNode(config.bridge);
        if (bridge instanceof HueBridgeConfig) {
            this.bridge = bridge;
            this.init();
        } else if (bridge === undefined || bridge == null) {
			this.status({fill: "red", shape: "ring", text: "huedoo-bridge-node.node.not-configured"});
        } else {
            throw new Error(`Wrong kind of bridge config! ${bridge}`);
        }
	}

    init() {
		this.status({fill: "grey", shape: "dot", text: "huedoo-bridge-node.node.connecting"});
        this.subscribeToBridge();
        this.on("input", this.handleMessage)
    }

    setConnected() {
        this.status({ fill: "green", shape: "dot", text: "huedoo-bridge-node.node.connected" });
    }

    subscribeToBridge() {
        // TODO
    }
    handleMessage(msg: NodeRed.NodeMessage, send: (msg: NodeRed.NodeMessage | Array<NodeRed.NodeMessage | NodeRed.NodeMessage[] | null>) => void, done: (err?: Error) => void): void {
        // TODO

    }
    getBridgeInformation(forceReload: boolean = false): Promise<Bridge | undefined> {
        return new Promise((resolve) => {
            if (forceReload || this._lastBridgeInformation === undefined) {
                if (!this.bridge) { resolve(undefined); return; };
                this.bridge.getBridgeInformation().then((bridgeInfo) => {
                    this._lastBridgeInformation = bridgeInfo;
                    resolve(bridgeInfo);
                });
            } else {
                resolve(this._lastBridgeInformation);
            }
        });
    }
}

module.exports = function (RED: NodeRed.NodeAPI) {
    function MakeNode(this: NodeRed.Node, config: HueBridgeDef) {
        RED.nodes.createNode(this, config);
        util.inherits(HueBridgeNode, this.constructor);
        return new HueBridgeNode(this, config, RED);
    }
	RED.nodes.registerType(
		"huedoo-bridge-node",
		MakeNode
	)
}

export default module.exports;
module.exports.HueBridgeNode = HueBridgeNode;
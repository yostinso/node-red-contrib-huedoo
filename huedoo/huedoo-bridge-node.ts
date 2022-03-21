import NodeRedNode from "./ES6Node";
import * as NodeRed from "node-red";
import { HueBridgeConfig, HueBridgeDef } from "./huedoo-bridge-config";
import { Bridge } from "./utils/types/api/bridge";

class HueBridge extends NodeRedNode {
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
        } else if (bridge === undefined) {
			this.status({fill: "red", shape: "ring", text: "hue-bridge.node.not-configured"});
            return;
        } else {
            throw new Error("Wrong kind of bridge config!")
        }

		this.init();
	}

    init() {
		this.status({fill: "grey", shape: "dot", text: "hue-bridge.node.connecting"});
        this.subscribeToBridge();
        this.on("input", this.handleMessage)
    }

    setConnected() {
        this.status({ fill: "green", shape: "dot", text: "hue-bridge.node.connected" });
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

export default function (RED: NodeRed.NodeAPI) {
    function MakeNode(this: NodeRed.Node, config: HueBridgeDef) {
        RED.nodes.createNode(this, config);
        return new HueBridge(this, config, RED);
    }
	RED.nodes.registerType(
		"huedoo-bridge-node",
		MakeNode
	)
}
import { any } from "async";
//import * as colorUtils from "./utils/color";
//import * as merge from "./utils/merge";
import * as NodeRed from "node-red";
import { HueLightMessageContents } from "./utils/messages";


type BridgeEventInfo = { id: string, suppressMessage: boolean | undefined }
type BridgeSubscribeFunctions =
  (event: "light", lightId: string, callback: (info: BridgeEventInfo) => void) => void;
type BridgeResourceTypes = "bridge" | "light" | "group" | "button" | "motion" | "temperature" | "light_level" | "rule";

type BridgeGetFunctions =
  ((type: "light", lightId: string | false, options: { colornames?: boolean }) => HueLightMessageContents | false) &
  ((type: BridgeResourceTypes, lightId: string | false, options: object) => object | false);

interface HueLightDefMaybeConfigured extends NodeRed.NodeDef {
    bridge: string | null | undefined;
    lightid: string | null | undefined;
    colornamer: boolean | undefined;
    skipevents: boolean | undefined;
    initevents: boolean | undefined;
}
interface HueLightDef extends HueLightDefMaybeConfigured {
    bridge: string;
}
interface HueBridge extends NodeRed.Node {
    disableupdates: boolean | undefined;
    subscribe: BridgeSubscribeFunctions;
    get: BridgeGetFunctions;
}

const MSG_TYPES = Object.freeze({
	STATUS: Symbol("STATUS")
});

class HueLight {
    private futurePatchState: object = {};
    private lastCommand: object | null = null;
    private readonly bridge: HueBridge;
    private readonly node: NodeRed.Node; 
    private readonly config: HueLightDef;

    constructor(RED: NodeRed.NodeAPI, node: NodeRed.Node, config: HueLightDef) {
        RED.nodes.createNode(node, config);
        this.node = node;
        this.bridge = RED.nodes.getNode(config.bridge) as HueBridge;
        this.config = config;

        if (!config.lightid) {
            // Universal mode
            node.status({ fill: "grey", shape: "dot", text: "hue-light.node.universal" });
            return;
        }
        if (this.bridge.disableupdates) {
            // Bridge disabled updates
			node.status({fill: "grey", shape: "dot", text: "hue-light.node.init"});
            return;
        }
        this.bridge.subscribe("light", config.lightid, this.handleLightEvent)
    }
    handleLightEvent(info: BridgeEventInfo) {
        let currentState = this.bridge.get("light", info.id, { colornames: this.config.colornamer ? true : false })
        if (currentState === false) {
            // Device not found
            return;
        }
        if (!this.config.skipevents) {
            if (this.config.initevents || info.suppressMessage === false) {
                // Send the current state as an out message
                if (this.lastCommand !== null) {
                    currentState.command = this.lastCommand;
                }
            }
        }
        
    }
}

module.exports = function (RED: NodeRed.NodeAPI) {
    RED.nodes.registerType(
        "hue-light",
        function(this: NodeRed.Node, config: HueLightDef) {
            RED.nodes.createNode(this, config);
            if (!config.bridge) {
                this.status({ fill: "red", shape: "ring", text: "hue-light.node.not-configured" });
            } else {
                new HueLight(RED, this, config);
            }
        }
    );
}
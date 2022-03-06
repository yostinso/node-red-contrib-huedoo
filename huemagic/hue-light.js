"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MSG_TYPES = Object.freeze({
    STATUS: Symbol("STATUS")
});
class HueLight {
    constructor(RED, node, config) {
        this.futurePatchState = {};
        this.lastCommand = null;
        RED.nodes.createNode(node, config);
        this.node = node;
        this.bridge = RED.nodes.getNode(config.bridge);
        this.config = config;
        if (!config.lightid) {
            // Universal mode
            node.status({ fill: "grey", shape: "dot", text: "hue-light.node.universal" });
            return;
        }
        if (this.bridge.disableupdates) {
            // Bridge disabled updates
            node.status({ fill: "grey", shape: "dot", text: "hue-light.node.init" });
            return;
        }
        this.bridge.subscribe("light", config.lightid, this.handleLightEvent);
    }
    handleLightEvent(info) {
        let currentState = this.bridge.get("light", info.id, { colornames: this.config.colornamer ? true : false });
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
module.exports = function (RED) {
    RED.nodes.registerType("hue-light", function (config) {
        RED.nodes.createNode(this, config);
        if (!config.bridge) {
            this.status({ fill: "red", shape: "ring", text: "hue-light.node.not-configured" });
        }
        else {
            new HueLight(RED, this, config);
        }
    });
};

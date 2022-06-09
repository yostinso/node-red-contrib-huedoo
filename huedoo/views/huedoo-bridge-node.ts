import NodeRedNode from "./ES6Node";

(() => {
    const config = {
        category: "HueDoo",
        color: "#b7b7b7",
        defaults: {
            name: { value: "" },
            bridge: { type: "huedoo-bridge-config", required: true },
            autoupdates: { value: true },
            disableevents: { value: false },
            initevents: { value: false }
        },
        align: "left",
        icon: "huedoo-bridge-node.png",
        inputs: 1,
        outputs: 1,
        // @ts-ignore
        label: function() { return this.name || this._("huedoo-bridge-node.node.title"); },
        // @ts-ignore
        paletteLabel: function() { return RED._("huedoo-bridge-node.node.title"); },
        // @ts-ignore
        inputLabels: function() { return RED._("huedoo-bridge-node.node.input"); },
        // @ts-ignore
        outputLabels: function() { return RED._("huedoo-bridge-node.node.output"); },
        button: {
            onclick: function() {
        // @ts-ignore
                if (this.bridge) {
                    $.ajax({
                        url: "inject/" + this.id,
                        type: "POST",
                        data: JSON.stringify({ __user_inject_props__: "status" }),
                        contentType: "application/json; charset=utf-8",
                        success: (resp) => {
        // @ts-ignore
                            RED.notify(
        // @ts-ignore
                                this.name + ": " + this._("huedoo-bridge-node.node.statusmsg"),
                                { type: "success", id: "status", timeout: 2000 }
                            );
                        }
                    })
                }
            }
        }

    };

        // @ts-ignore
    RED.nodes.registerType("huedoo-bridge-node", config);
})();
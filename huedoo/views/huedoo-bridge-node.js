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
    label: function() { return this.name || this._("huedoo-bridge-node.node.title"); },
    paletteLabel: function() { return this._("huedoo-bridge-node.node.title"); },
    inputLabels: function() { return this._("huedoo-bridge-node.node.input"); },
    outputLabels: function() { return this._("huedoo-bridge-node.node.output"); },
    button: {
        onclick: () => {
            if (this.bridge) {
                $.ajax({
                    url: "inject/" + this.id,
                    type: "POST",
                    data: JSON.stringify({ __user_inject_props__: "status" }),
                    contentType: "application/json; charset=utf-8",
                    success: (resp) => {
                        RED.notify(
                            this.name + ": " + this._("huedoo-bridge-node.node.statusmsg"),
                            { type: "success", id: "status", timeout: 2000 }
                        );
                    }
                })
            }
        }
    }

};

RED.nodes.registerType("huedoo-bridge-node", config);
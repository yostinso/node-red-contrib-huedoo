// TODO: Build this node w/ TS also
const ipRe = /^(\d+\.){3}\d+$/;
const config = {
    category: "config",
    color: "#c7d8d8",
    defaults: {
        name: { value: "Hue Bridge", required: true },
        bridge: { value: "", required: true },
        key: { value: "", required: true },
        worker: {
            value: 10, required: true, validate: (v) => (!isNaN(v) && v > 0)
        },
        autoupdates: { value: true },
        disableevents: { value: false }
    },
    icon: "huedoo-bridge-config.png",
    label: function() { return this.name; },
    paletteLabel: function() { return this._("huedoo-bridge-config.node.title"); },
    oneditprepare: function() {
        $(document).off("change", "#node-config-input-bridge");
        $(document).on("change", "#node-config-input-bridge", (evt) => {
            let currentIP = $(evt.currentTarget).val();
            if (ipRe.test(currentIP)) {
                let notification = RED.notify(
                    this._("huedoo-bridge-config.config.connecting"),
                    { type: "compact", modal: true, fixed: true }
                );
                $.ajax({
                    url: "hue/name",
                    type: "GET",
                    data: { ip: currentIP },
                    timeout: 3000
                }).done((data) => {
                    $("#node-config-input-name").val(data);
                    setTimeout(() => notification.close(), 500);
                }).fail((err) => {
                    notification.close();
                    RED.notify(this._("huedoo-bridge-config.config.invalid") + err.statusText, "error");
                })
            }
        });
    }
}
RED.nodes.registerType("huedoo-bridge-config", config)
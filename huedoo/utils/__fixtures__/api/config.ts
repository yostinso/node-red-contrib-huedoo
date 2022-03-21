import uuid from "./uuid";
import { BridgeV1Response  } from "../../types/api/bridge";

let lastId = 0;
function nextId(): string {
    return `${lastId++}`;
}

interface BridgeConfig extends Partial<BridgeV1Response> {

}

interface SwUpdate {
    updatestate: number,
    checkforupdate: boolean,
    devicetypes: {
        bridge: boolean,
        lights: string[],
        sensors: string[]
    },
    url: string,
    text: string,
    notify: boolean
}
const swUpdateTemplate: SwUpdate = {
    "updatestate": 0,
    "checkforupdate": false,
    "devicetypes": {
        "bridge": false,
        "lights": [],
        "sensors": []
    },
    "url": "",
    "text": "",
    "notify": true
}

function swUpdate(extras: Partial<SwUpdate> = {}): SwUpdate {
    return {
        ...swUpdateTemplate,
        ...extras
    };
}

interface SwUpdate2 {
    checkforupdate: boolean,
    lastchange: string,
    bridge: {
        state: string,
        lastinstall: string,
    },
    state: string,
    autoinstall: {
        updatetime: string,
        on: boolean
    }
}
const swUpdate2Template: SwUpdate2 = {
    "checkforupdate": false,
    "lastchange": "2022-02-14t22:21:31",
    "bridge": {
        "state": "noupdates",
        "lastinstall": "2022-01-31t22:36:37"
    },
    "state": "noupdates",
    "autoinstall": {
        "updatetime": "t14:00:00",
        "on": true
    }
}
function swUpdate2(extras: Partial<SwUpdate2> = {}): SwUpdate2 {
    return {
        ...swUpdate2Template,
        ...extras
    };
}

const bridgeTemplate: BridgeV1Response = {
  "name": "Philips hue",
  "zigbeechannel": 11,
  "bridgeid": "AAAAAAAAAAAAAAAA",
  "mac": "00:11:22:33:44:55",
  "dhcp": true,
  "ipaddress": "192.168.l.100",
  "netmask": "255.255.255.0",
  "gateway": "192.168.1.1",
  "proxyaddress": "none",
  "proxyport": 0,
  "UTC": "2022-03-15T15:53:54",
  "localtime": "2022-03-15T08:53:54",
  "timezone": "America/Los_Angeles",
  "modelid": "BSB002",
  "datastoreversion": "117",
  "swversion": "1949203030",
  "apiversion": "1.48.0",
  // swupdate: {}
  // swupdate2: {}
  "linkbutton": false,
  "portalservices": true,
  "portalconnection": "connected",
  "portalstate": {
    "signedon": true,
    "incoming": false,
    "outgoing": true,
    "communication": "disconnected"
  },
  "internetservices": {
    "internet": "connected",
    "remoteaccess": "connected",
    "time": "connected",
    "swupdate": "connected"
  },
  "factorynew": false,
  "replacesbridgeid": null,
  "backup": {
    "status": "idle",
    "errorcode": 0
  },
  "starterkitid": "",
  "whitelist": {
    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee": {
      "last use date": "2020-02-16T02:24:08",
      "create date": "2019-12-21T03:01:43",
      "name": "My Client#My Device Type"
    },
  }
}

interface WhitelistItem {
    uuid: string,
    "last use date": string;
    "create date": string;
    name: string;
}
interface Whitelist {
    [id: string]: WhitelistItem
}
const templateWhitelistItem = {
    "uuid": uuid(),
    "last use date": "2020-02-16T02:24:08",
    "create date": "2019-12-21T03:01:43",
    "name": "My Client#My Device Type"
}
export function whitelistItem(uid?: string, extras: Partial<WhitelistItem> = {}): WhitelistItem {
    let userId = uid === undefined ? uuid() : uid;
    return {
        ...templateWhitelistItem,
        uuid: userId,
        ...extras
    }
}

export function makeConfig(bridgeid: string = "AAAAAAAAAAAAAAAA", whitelistItems?: WhitelistItem[], extras: Partial<BridgeV1Response> = {}): BridgeV1Response {
    let swupdate = swUpdate();
    let swupdate2 = swUpdate2();
    let whitelist = (whitelistItems || [whitelistItem()]).reduce((memo, item) => {
        let { uuid, ...rest } = item;
        return { ...memo, [uuid]: rest };
    }, {})
    return {
        ...bridgeTemplate,
        bridgeid,
        swupdate,
        swupdate2,
        whitelist
    }
}

export const defaultBridgeConfig = Object.seal(makeConfig());
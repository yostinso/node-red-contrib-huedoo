import { ResourceResponse } from "../../types/api/resource";
import { Device } from "../../types/resources/device";
import { OwnedResourceType, RealResourceType, ResourceRef } from "../../types/resources/generic";
import { Light } from "../../types/resources/light";
import uuid from "./uuid";
let lastId = 0;
function nextId(): number {
    return lastId++;
}

const lightTemplate: Light = {
    alert: {
        action_values: [ "breathe" ]
    },
    color_temperature: {
        mirek: 370,
        mirek_schema: {
            mirek_maximum: 454,
            mirek_minimum: 153
        },
        mirek_valid: true
    },
    dimming: {
        brightness: 100,
        min_dim_level: 0.20000000298023224
    },
    dynamics: {
        speed: 0,
        speed_valid: false,
        status: "none",
        status_values: [ "none" ]
    },
    effects: {
        effect_values: [ "no_effect", "candle" ],
        status: "no_effect",
        status_values: [ "no_effect", "candle" ]
    },
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    id_v1: "/lights/43",
    metadata: {
        archetype: "recessed_ceiling",
        name: "Some Light"
    },
    mode: "normal",
    on: {
        on: false
    },
    /*
    owner: {
        rid: "11111111-2222-3333-4444-555555555555",
        rtype: "device"
    },
    */
    type: "light"
}

export function makeLight(id: string, lightName?: string, owner?: ResourceRef<RealResourceType>, extras: Partial<Light> = {}): Light {
    let name = lightName === undefined ? `Light ${id}` : lightName;
    let metadata = {
        ...lightTemplate.metadata,
        ...extras.metadata,
        name
    };
    return {
        ...lightTemplate,
        id,
        id_v1: `/lights/${nextId()}`,
        owner,
        metadata,
        ...extras
    };
}

const deviceTemplate: Device = {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    id_v1: "/sensors/50",
    metadata: {
        archetype: "unknown_archetype",
        name: "My Dimmer"
    },
    product_data: {
        certified: true,
        hardware_platform_type: "100b-109",
        manufacturer_name: "Signify Netherlands B.V.",
        model_id: "RWL020",
        product_archetype: "unknown_archetype",
        product_name: "Hue dimmer switch",
        software_version: "1.1.28573"
    },
    /*
    services: [
        {
            rid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            rtype: "button"
        },
    ],
    */
    type: "device"
}
export function makeDevice(id: string, deviceName?: string, services?: ResourceRef<OwnedResourceType>[], extras: Partial<Device> = {}): Device {
    let name = deviceName === undefined ? `Device ${id}` : deviceName;
    let metadata = {
        ...deviceTemplate.metadata,
        ...extras.metadata,
        name
    };
    return {
        ...deviceTemplate,
        id,
        id_v1: `/lights/${nextId()}`,
        metadata,
        ...extras
    };
}


const resourceMakers = {
    Light: makeLight,
    Device: makeDevice
};
export function makeResources(count: number = 2, types: (keyof typeof resourceMakers)[] = [] ): ResourceResponse<RealResourceType>[] {
    let makers = types.length == 0 ? Object.values(resourceMakers) : types.map((t) => resourceMakers[t]);
    let resources: ResourceResponse<RealResourceType>[] = [];
    for (let i = 0; i < count; i++) {
        let makeResource = makers[i % makers.length];
        resources.push(makeResource(uuid()));
    }
    return resources;
}

export const defaultResources = makeResources(2);
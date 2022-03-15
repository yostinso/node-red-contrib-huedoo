import { OwnedResourceType, ResourceId, ResourceRef, ServiceOwnerResource } from "./generic";

export interface Device extends ServiceOwnerResource<"device"> {
    type: "device";
    id: ResourceId;
    id_v1: string;
    metadata?: {
        archetype?: string;
        name: string;
    }
    product_data?: {
        certified: boolean;
        hardware_platform_type: string;
        manufacturer_name: string;
        model_id: string;
        product_archetype: string;
        product_name: string;
        software_version: string;
    }
}
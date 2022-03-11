import { diff } from "deep-object-diff";

function isObject(obj: any): obj is object {
    return obj && typeof obj === "object";
}
function isArray(obj: any): obj is any[] {
    return obj && Array.isArray(obj);
}

function mergeResource(...objects: any) {
    // BEGIN MERGING …

    return objects.reduce((prev: any, obj: any) => {
        Object.keys(obj).forEach((key) => {
            const pVal = prev[key];
            const oVal = obj[key];

            if(isArray(pVal) && isArray(oVal)) {
                prev[key] = [ ...pVal, ...oVal ];
            } else if (isObject(pVal) && isObject(oVal)) {
                prev[key] = mergeResource(pVal, oVal);
            } else {
                prev[key] = oVal;
            }
        });

        return prev;
    }, {});
}

export function mergeDeep<T extends any>(left: T, right: T): T {
    return mergeResource(left, right) as T;
}

export function isDiff(left: any, right: any): boolean {
    return Object.values(diff(left, right)).length > 0;
}
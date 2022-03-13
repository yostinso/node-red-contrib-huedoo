import { mergeDeep, isDiff } from "../utils/merge";

describe(mergeDeep, () => {
    it("should merge two shallow objects", () => {
        const left: object = { a: 1 };
        const right: object = { b: 2 };
        expect(mergeDeep(left, right)).toStrictEqual({ a: 1, b: 2 })
    });
    it("should merge objects containing arrays", () => {
        const left = { a: [ 1, 2 ] };
        const right = { a: [3, 4 ] };
        expect(mergeDeep(left, right)).toStrictEqual({ a: [1, 2, 3, 4] });
    })
    it("should merge objects containing other objects", () => {
        const left: object = { a: { b: 1 } };
        const right: object = { a: { c: 2 } };
        expect(mergeDeep(left, right)).toStrictEqual({ a: { b: 1, c: 2 } })
    });
    it("should recursively merge", () => {
        const left: object = { a: { b: [1, 2] } };
        const right: object = { a: { b: [3, 4] } };
        expect(mergeDeep(left, right)).toStrictEqual({ a: { b: [1, 2, 3, 4] } })
        
    });
});
describe(isDiff, () => {
    it("should return false for objects that are the same", () => {
        const left = {a: 1, b: [2, 3] };
        const right = {a: 1, b: [2, 3] };
        expect(isDiff(left, right)).toBeFalsy();
    })
    it("should return true for objects that differ", () => {
        const left = {a: 1, b: [2, 4] };
        const right = {a: 1, b: [2, 3] };
        expect(isDiff(left, right)).toBeTruthy();
    });
});

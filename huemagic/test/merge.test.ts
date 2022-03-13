import { mergeDeep, isDiff } from "../utils/merge";

describe("mergeDeep", () => {
    it("should merge two shallow objects", () => {
        const left: object = { a: 1 };
        const right: object = { b: 2 };
        expect(mergeDeep(left, right)).toStrictEqual({ a: 1, b: 2 })
    });
})
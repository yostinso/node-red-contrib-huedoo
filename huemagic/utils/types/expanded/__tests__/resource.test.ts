import exp from "constants";
import { makeButtonGroup } from "../../../__fixtures__/api/resources";
import { Button } from "../../resources/button";
import { expandedResources } from "../resource";

describe(expandedResources, () => {
    it("needs a good starting point (test the fixture)", () => {
        let [ group, buttons ] = makeButtonGroup("Button Group");
        // Buttons.owner are a ResourceRef to the group
        buttons.forEach((btn) => {
            expect(btn.owner).toEqual({ rtype: group.type, rid: group.id })
        })
        // The group.services is an array of ResourceRefs to each button
        let buttonRefs = buttons.map((btn) => {
            return { rtype: btn.type, rid: btn.id };
        }).sort();
        expect(group.services.sort()).toEqual(buttonRefs);
    })
    it("should expand the services on a group", () => {
        let [ group, buttons ] = makeButtonGroup("Button Group");
        let [ expanded, grouped ] = expandedResources([ group, ...buttons ]);

        const expandedButtons = buttons.reduce((memo, btn) => {
            memo[btn.id] = btn;
            return memo;
        }, {} as { [id: string]: Button });
        
        // TODO This isn't working; I expect 4 entries not one
        expect(false).toBe(true);
        console.log(expanded[group.id]);
        expect(expanded[group.id]).toEqual(expect.objectContaining({
            services: { button: expect.objectContaining(expandedButtons) }
        }));
    });
    it.todo("should generate grouped_services");
});
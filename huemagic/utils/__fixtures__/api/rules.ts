import dayjs from "dayjs";
import { RulesV1Response, RulesV1ResponseItem } from "../../types/api/rules";


function uuid() {
    return crypto.randomUUID();
}
let lastId = 0;
function nextId(): string {
    return `${lastId++}`;
}

const ruleTemplate: RulesV1ResponseItem = {
    "name": "1:",
    "owner": uuid(),
    "created": "2022-02-22T22:22:22",
    "lasttriggered": "none",
    "timestriggered": 0,
    "status": "enabled",
    "recycle": true,
    "conditions": [
        {
            "address": "/groups/2/state/all_on",
            "operator": "eq",
            "value": "false"
        },
        {
            "address": "/groups/2/state/all_on",
            "operator": "dx"
        },
        {
            "address": "/sensors/44/state/status",
            "operator": "gt",
            "value": "0"
        }
    ],
    "actions": [
        {
            "address": "/sensors/44/state",
            "method": "PUT",
            "body": {
                "status": 0
            }
        }
    ]
}

interface Rule extends Partial<RulesV1ResponseItem> {
    id: string;
}

function rule(id: string, extras: Partial<RulesV1ResponseItem> = {}): Rule {
    let name: string = (extras.name === undefined) ? `${id}:` : extras.name;

    return {
        ...ruleTemplate,
        id: id,
        name,
        created: dayjs().format(),
        ...extras
    };
}

export function makeRules(count: number = 2): RulesV1Response {
    const rules: RulesV1Response = {};
    for (let i = 0; i < count; i++) {
        let id = nextId();
        rules[id] = rule(id) as RulesV1ResponseItem;
    }
    return rules;
}

export function addRule(rules: RulesV1Response, rule: Rule): RulesV1Response {
    return {
        ...rules,
        [rule.id]: rule as RulesV1ResponseItem,
    }
}
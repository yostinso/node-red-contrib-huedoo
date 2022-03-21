import { Method } from "axios";
import { RulesV1Response, RulesV1ResponseItem } from "../../types/api/rules";
import uuid from "./uuid";
const dayjs = jest.requireActual("dayjs");

let lastId = 0;
function nextId(): string {
    return `${lastId++}`;
}

interface Action {
    address: string;
    method: Method;
    body: object;
}

const actionTemplate: Action = {
    "address": "/sensors/44/state",
    "method": "PUT",
    "body": {
        "status": 0
    }
}

function action(address: string, method: Method = "PUT", body: object = { status: 0 }, extras: object = {}): Action {
    return {
        ...actionTemplate,
        address,
        method,
        body,
        ...extras
    }
}

interface Rule extends Partial<RulesV1ResponseItem> {
    id: string;
}

interface Condition {
    address: string;
    operator: string;
    value?: string;
}

const conditionTemplate: Condition = {
    "address": "/groups/2/state/all_on",
    "operator": "eq",
    "value": "false"
}

function condition(address: string, operator: string = "eq", value?: string): Condition {
    return {
        ...conditionTemplate,
        address,
        operator,
        value: value === undefined ? conditionTemplate.value : value
    };
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
};

function makeRule(id: string, ruleActions?: Action[], ruleConditions?: Condition[], extras: Partial<RulesV1ResponseItem> = {}): Rule {
    let name: string = (extras.name === undefined) ? `${id}:` : extras.name;
    let actions: Action[] = ruleActions || [ action("/test/action") ]
    let conditions: Condition[] = ruleConditions || [ condition("/test/condition") ]

    return {
        ...ruleTemplate,
        id,
        name,
        actions,
        conditions,
        created: dayjs().format(),
        ...extras
    };
}

export function makeRules(count: number = 2): RulesV1Response {
    const rules: RulesV1Response = {};
    for (let i = 0; i < count; i++) {
        let id = nextId();
        rules[id] = makeRule(id) as RulesV1ResponseItem;
    }
    return rules;
}

export function addRule(rules: RulesV1Response, rule: Rule): RulesV1Response {
    return {
        ...rules,
        [rule.id]: rule as RulesV1ResponseItem,
    }
}

export const defaultRules = makeRules(2);
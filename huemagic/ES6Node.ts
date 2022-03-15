import { Node, NodeContext, NodeMessage, NodeMessageInFlow, NodeStatus } from "node-red";

/*
 * This is a hack on TypeScript that lets us "extend" a node object so that we
 * can use ES6 classes with all the proper type hinting instead of constructor
 * functions. Object.assign(this, node) acts as a poor-man's "inherit", and so we
 * can @ts-ignore all the warnings about missing implementations/assignment in the
 * constructor.
 */
interface NodeEventTarget {
    once(eventName: string | symbol, listener: (...args: any[]) => void): this;
}
interface StaticEventEmitterOptions {
    signal?: AbortSignal | undefined;
}
interface DOMEventTarget {
    addEventListener(
        eventName: string,
        listener: (...args: any[]) => void,
        opts?: {
            once: boolean;
        },
    ): any;
}

export class ES6Node implements Node {
    // @ts-ignore
    id: string 
    // @ts-ignore
    type: string;
    // @ts-ignore
    z: string;
    // @ts-ignore
    name?: string | undefined;
    // @ts-ignore
    credentials: object;
    // @ts-ignore
    updateWires(wires: Array<[]>): void;
    // @ts-ignore
    context(): NodeContext;
    // @ts-ignore
    close(removed: boolean): Promise<void>;
    // @ts-ignore
    send(msg?: NodeMessage | Array<NodeMessage | NodeMessage[] | null>): void;
    // @ts-ignore
    receive(msg?: NodeMessage): void;
    // @ts-ignore
    log(msg: any): void;
    // @ts-ignore
    warn(msg: any): void;
    // @ts-ignore
    error(logMessage: any, msg?: NodeMessage): void;
    // @ts-ignore
    debug(msg: any): void;
    // @ts-ignore
    trace(msg: any): void;
    // @ts-ignore
    metric(): boolean;
    // @ts-ignore
    metric(eventname: string, msg: NodeMessage, metricValue: number): void;
    // @ts-ignore
    status(status: string | NodeStatus): void;
    on(
        event: 'input',
        listener: (
            msg: NodeMessageInFlow,
            send: (msg: NodeMessage | Array<NodeMessage | NodeMessage[] | null>) => void,
            done: (err?: Error) => void,
        ) => void,
    ): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'close', listener: (done: () => void) => void): this; // tslint:disable-line:unified-signatures
    // @ts-ignore
    on(event: 'close', listener: (removed: boolean, done: () => void) => void): this; // tslint:disable-line:unified-signatures


    /* EVENT EMITTER */
    // @ts-ignore
    addListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    // @ts-ignore
    once(eventName: string | symbol, listener: (...args: any[]) => void): this;
    // @ts-ignore
    removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    // @ts-ignore
    off(eventName: string | symbol, listener: (...args: any[]) => void): this;
    // @ts-ignore
    prependListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    // @ts-ignore
    removeAllListeners(event?: string | symbol): this;
    // @ts-ignore
    setMaxListeners(n: number): this;
    // @ts-ignore
    getMaxListeners(): number;
    // @ts-ignore
    listeners(eventName: string | symbol): Function[];
    // @ts-ignore
    rawListeners(eventName: string | symbol): Function[];
    // @ts-ignore
    emit(eventName: string | symbol, ...args: any[]): boolean;
    // @ts-ignore
    listenerCount(eventName: string | symbol): number;
    // @ts-ignore
    prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): this;
    // @ts-ignore
    eventNames(): Array<string | symbol>;

    constructor(node: Node) {
        Object.assign(this, node);
    }
}
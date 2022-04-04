import EventEmitter from "events";
import { ResourceId, ResourceType } from "./types/resources/generic";

export interface TypedEvent {

}

export default interface TypedEmitter<K extends (string | symbol), T extends TypedEvent> extends NodeJS.EventEmitter {
    addListener(eventName: K, listener: (event: T) => void): this;
    on(eventName: K, listener: (event: T) => void): this;
    once(eventName: K, listener: (event: T) => void): this;
    removeListener(eventName: K, listener: (event: T) => void): this;
    off(eventName: K, listener: (event: T) => void): this;
    removeAllListeners(event?: string | symbol): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    listeners(eventName: K): Function[];
    rawListeners(eventName: K): Function[];
    emit(eventName: K, event: T): boolean;
    listenerCount(eventName: K): number;
    prependListener(eventName: K, listener: (event: T) => void): this;
    prependOnceListener(eventName: K, listener: (event: T) => void): this;
    eventNames(): Array<string | symbol>;

}

export default class TypedEmitter<K extends (string | symbol), T extends TypedEvent> extends EventEmitter implements TypedEmitter<K, T> {
    
}
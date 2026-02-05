//A simple events system for effectively direct links without actualy linking files or references
type Event = [string, any, any]

class EventManager {
    private activeEvents: Event[] = [];
    private listeners: any = {};

    constructor() {
        this.activeEvents = [];
        this.listeners = {};
    }


    public raise(eventType: string, eventData: any, extraEventData?: any): void {
        this.activeEvents.push([eventType, eventData, extraEventData]);
        if (this.listeners[eventType] == undefined) {
            return;
        }
        while (this.activeEvents.length > 0) {
            const [type, data, extraData] = this.activeEvents[0];
            for (let i: number = 0; i < this.listeners[type].length; i++) {
                this.listeners[type][i](data, extraData);
            }
            this.activeEvents.splice(0, 1);
        }
    }

    public listen(eventType: string, callback: Function): void {
        if (this.listeners[eventType] == undefined) {
            this.listeners[eventType] = [];
        }
        this.listeners[eventType].push(callback);
    }

    public unlisten(eventType: string, callback: Function): void {
        if (this.listeners[eventType] == undefined) {
            return;
        }
        const listen = this.listeners[eventType].indexOf(callback);
        if (listen != -1) {
            this.listeners[eventType].splice(listen, 1);
        }
    }
    public unlistenAll(eventType: string): void {
        if (this.listeners[eventType] == undefined) {
            return;
        }
        this.listeners[eventType] = [];
    }
}

export const events: EventManager = new EventManager()
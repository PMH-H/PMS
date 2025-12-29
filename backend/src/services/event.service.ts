import EventEmitter from 'events';

class EventService extends EventEmitter {
    private static instance: EventService;

    private constructor() {
        super();
    }

    public static getInstance(): EventService {
        if (!EventService.instance) {
            EventService.instance = new EventService();
        }
        return EventService.instance;
    }
}

export const eventBus = EventService.getInstance();
export const EVENTS = {
    SALE_COMPLETED: 'SALE_COMPLETED',
    RX_UPDATE: 'RX_UPDATE',
    INVENTORY_ALERT: 'INVENTORY_ALERT',
    USER_LOGGED_IN: 'USER_LOGGED_IN'
};

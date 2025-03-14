export interface Event {
    id: number;
    dates: string;
    location: string;
    name: string;
    link?: string;
}

export interface EventDTO {
    dates: string;
    location: string;
    name: string;
    link?: string;
}

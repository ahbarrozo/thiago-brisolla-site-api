export interface Contact {
    id: number;
    address?: string;
    contact: string;
    mail: string;
    name: string;
    phone?: string;
}

export interface ContactDTO {
    address?: string;
    contact: string;
    mail: string;
    name: string;
    phone?: string;
}

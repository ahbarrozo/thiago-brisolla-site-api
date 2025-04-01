import { Image } from './Image.type';

export interface Work {
    id: number;
    date: string;
    description: string;
    title: string;
    images: Image[];
    link?: string;
}

export interface WorkDTO {
    date: string;
    description: string;
    title: string;
    link?: string;
}

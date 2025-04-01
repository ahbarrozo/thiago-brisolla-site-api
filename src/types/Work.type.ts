import { Image } from './Image.type';

export interface Work {
    id: number;
    date: string;
    description: string;
    title: string;
    images: Image[];
}

export interface WorkDTO {
    date: string;
    description: string;
    title: string;
}

import { Image } from './Image.type';

export interface Album {
    id: number;
    date: string;
    description: string;
    title: string;
    image?: Image;
}

export interface AlbumDTO {
    date: string;
    description: string;
    title: string;
}

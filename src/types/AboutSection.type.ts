import { Image } from './Image.type';

export interface AboutSection {
    id: number;
    text: string;
    image?: Image;
}

export interface AboutSectionDTO {
    text: string;
}

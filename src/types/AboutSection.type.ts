import { Image } from './Image.type';

export interface AboutSection {
    id: number;
    text: string;
    images: Image[];
}

export interface AboutSectionDTO {
    text: string;
}

import { Image } from './Image.type';

export interface BlogPost {
  id: number;
  date: string;
  title: string;
  subtitle?: string;
  text: string;
  images: Image[];
}

export interface BlogPostDTO {
    title: string;
    subtitle?: string;
    text: string;
}

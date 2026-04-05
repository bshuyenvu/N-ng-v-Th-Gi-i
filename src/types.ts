export type AspectRatio = '16:9' | '4:5' | '9:16';
export type StylePreset = 'Bình thường' | 'Đỏ Tin Nóng' | 'Trắng Thanh Lịch' | 'Điện Ảnh Tối' | 'Phong Cách Thăm Dò';
export type QualityLevel = 'Standard' | 'Pro';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface GraphicData {
  banner: string;
  headline: string;
  subline: string;
  watermark: string;
  aspectRatio: AspectRatio;
  style: StylePreset;
  quality: QualityLevel;
  images: string[];
  generatedBackground: string | null;
}

export const PRESET_TEXTS = ['TIN NÓNG', 'CẬP NHẬT', 'BẠN NGHĨ SAO?', 'GÓC NHÌN'];

export const PROMPT_TEMPLATES = [
  {
    name: 'Bình thường',
    prompt: 'Enhance the provided image to be significantly sharper, clearer, and brighter while strictly maintaining the original composition, subjects, and details. If no image is provided, generate a clean, versatile professional news background with balanced lighting.',
  },
  {
    name: 'Tin Tức Nóng',
    prompt: 'A high-contrast, professional breaking news background. Cinematic lighting, dramatic atmosphere, clean composition for news overlay. No text, no watermarks.',
  },
  {
    name: 'Cập Nhật Quân Sự',
    prompt: 'A professional military or tactical briefing background. High-tech, serious, cinematic documentary style. No text, no watermarks.',
  },
  {
    name: 'Thăm dò / Tương tác',
    prompt: 'A clean, modern editorial background designed for social media engagement. Balanced composition, soft but professional lighting. No text, no watermarks.',
  },
  {
    name: 'Tuyên Bố Chính Trị',
    prompt: 'A formal, dignified editorial background suitable for political or official statements. Minimalist but powerful. No text, no watermarks.',
  },
  {
    name: 'Studio News',
    prompt: 'A high-end, modern news studio interior. Professional broadcasting equipment, soft studio lighting, bokeh background, and a sophisticated newsroom atmosphere. Clean and ready for text overlay.',
  },
  {
    name: 'Xung Đột Quốc Tế',
    prompt: 'A dramatic, global-scale news background. High-impact visual storytelling, cinematic and professional. No text, no watermarks.',
  },
];

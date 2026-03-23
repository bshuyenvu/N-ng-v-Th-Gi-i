/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { toPng } from 'html-to-image';
import { 
  Upload, 
  Download, 
  RefreshCw, 
  Image as ImageIcon, 
  Type, 
  Settings, 
  Layout, 
  ChevronRight,
  Sparkles,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  AspectRatio, 
  StylePreset, 
  GraphicData, 
  PRESET_TEXTS, 
  PROMPT_TEMPLATES 
} from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [data, setData] = useState<GraphicData>({
    banner: 'TIN NÓNG',
    headline: 'TIÊU ĐỀ BẢN TIN QUAN TRỌNG',
    subline: 'Mô tả chi tiết về sự kiện đang diễn ra tại đây để người xem nắm bắt thông tin nhanh chóng.',
    watermark: '@Nang&TheGioi',
    aspectRatio: '16:9',
    style: 'Bình thường',
    images: [],
    generatedBackground: null,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setData(prev => ({ 
            ...prev, 
            images: [...prev.images, reader.result as string].slice(-4) // Limit to 4 images for better AI mixing
          }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const [selectedTemplate, setSelectedTemplate] = useState(PROMPT_TEMPLATES[0]);

  const generateBackground = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      console.log("Starting background generation...");
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Step 1: Translate/Refine text and get visual context
      console.log("Refining text and context...");
      const refinementResponse = await genAI.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze these news elements and:
        1. Translate them into natural, professional Vietnamese if needed.
        2. Provide a very detailed English visual description for an AI image generator based on the content. 
           If it's a specific event or person, describe their typical appearance and setting.
        
        Return ONLY a JSON object with keys: banner, headline, subline, visualDescription.
        
        Banner: ${data.banner}
        Headline: ${data.headline}
        Subline: ${data.subline}`,
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }] // Search is supported on the text model
        }
      });

      const refined = JSON.parse(refinementResponse.text || '{}');
      console.log("Refinement complete:", refined);
      
      setData(prev => ({
        ...prev,
        banner: refined.banner || prev.banner,
        headline: refined.headline || prev.headline,
        subline: refined.subline || prev.subline
      }));

      const parts = [];
      
      // Add text prompt
      const getStyleDescription = (style: string) => {
        switch (style) {
          case 'Đỏ Tin Nóng': return 'High-energy, dynamic red-themed news atmosphere with high contrast.';
          case 'Trắng Thanh Lịch': return 'Clean, elegant, white and blue professional atmosphere with soft lighting.';
          case 'Điện Ảnh Tối': return 'Dark, cinematic, sophisticated atmosphere with dramatic amber lighting.';
          case 'Phong Cách Thăm Dò': return 'Modern, engaging, social-media friendly atmosphere with emerald green accents.';
          default: return 'Professional news atmosphere.';
        }
      };

      const isNormalTemplate = selectedTemplate.name === 'Bình thường';

      let promptText = `Generate a professional, high-contrast news background composition for a Vietnamese news channel. 
      Visual Style: ${selectedTemplate.prompt}.
      Content Context: ${refined.visualDescription || data.headline}.
      Layout style: ${data.images.length > 0 ? (isNormalTemplate ? 'Strictly maintain the original image composition, subjects, and details. Only enhance sharpness and brightness.' : (data.images.length > 1 ? 'Dynamic collage or blended composition of the provided images' : 'Single main visual based on the provided image')) : 'Cinematic professional news graphic from scratch'}.
      Atmosphere: ${getStyleDescription(data.style)}.
      CRITICAL INSTRUCTIONS: 
      1. Create a clean visual background ONLY. 
      2. DO NOT include any text, letters, characters, or watermarks in the image. 
      3. Ensure no English words or Latin characters appear in the background elements.
      4. The composition should be cinematic and professional.
      ${data.images.length > 0 ? (isNormalTemplate ? '5. DO NOT change the content of the provided image. Only make it sharper and brighter.' : '5. Use the provided images as the MAIN visual content, blending them seamlessly.') : '5. Since no images are provided, use Google Search to find accurate visual references for the topic and generate a realistic, high-quality news background.'}
      6. The final image should look like a professional news graphic.`;
      
      parts.push({ text: promptText });

      // Add images as parts if available
      data.images.forEach((img) => {
        const [header, base64Data] = img.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || "image/png";
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      });

      console.log("Generating image with Gemini 2.5 Flash Image...");
      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: data.aspectRatio === '16:9' ? '16:9' : data.aspectRatio === '4:5' ? '3:4' : '9:16',
          }
        }
      });

      let foundImage = false;
      if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            console.log("Image generated successfully!");
            setData(prev => ({ ...prev, generatedBackground: `data:image/png;base64,${part.inlineData.data}` }));
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        console.error("No image part found in response:", response);
        throw new Error("Không tìm thấy hình ảnh trong phản hồi từ AI.");
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      setError(`Có lỗi xảy ra: ${err.message || "Vui lòng thử lại."}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportImage = useCallback(async () => {
    if (previewRef.current === null) return;
    
    try {
      const dataUrl = await toPng(previewRef.current, { 
        cacheBust: true, 
        quality: 1,
        pixelRatio: 5 // Tăng độ phân giải lên 5 lần để font chữ lớn và rõ nét hơn khi xuất
      });
      const link = document.createElement('a');
      link.download = `nang-the-gioi-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Lỗi khi xuất ảnh', err);
    }
  }, [previewRef]);

  const getAspectRatioClass = () => {
    switch (data.aspectRatio) {
      case '16:9': return 'aspect-video';
      case '4:5': return 'aspect-[4/5]';
      case '9:16': return 'aspect-[9/16]';
      default: return 'aspect-video';
    }
  };

  const getStyleClasses = () => {
    switch (data.style) {
      case 'Bình thường':
        return {
          banner: 'bg-yellow-400 text-red-600',
          headline: 'text-yellow-400 drop-shadow-md',
          subline: 'text-zinc-100',
          overlay: 'bg-black/40',
          accent: 'border-l-4 border-yellow-400'
        };
      case 'Đỏ Tin Nóng':
        return {
          banner: 'bg-red-600 text-white',
          headline: 'text-yellow-400 drop-shadow-lg',
          subline: 'text-gray-200',
          overlay: 'bg-gradient-to-t from-black/90 via-black/40 to-transparent',
          accent: 'border-l-4 border-red-600'
        };
      case 'Trắng Thanh Lịch':
        return {
          banner: 'bg-blue-600 text-white',
          headline: 'text-yellow-600',
          subline: 'text-gray-700',
          overlay: 'bg-white/80 backdrop-blur-sm',
          accent: 'border-l-4 border-blue-600'
        };
      case 'Điện Ảnh Tối':
        return {
          banner: 'bg-zinc-800 text-amber-400',
          headline: 'text-yellow-400 font-light tracking-tight',
          subline: 'text-zinc-400',
          overlay: 'bg-black/60',
          accent: 'border-l-4 border-amber-400'
        };
      case 'Phong Cách Thăm Dò':
        return {
          banner: 'bg-emerald-600 text-white',
          headline: 'text-yellow-400 text-center',
          subline: 'text-gray-200 text-center',
          overlay: 'bg-gradient-to-b from-black/20 via-black/60 to-black/90',
          accent: 'border-t-4 border-emerald-600'
        };
      default:
        return {
          banner: 'bg-red-600 text-white',
          headline: 'text-yellow-400',
          subline: 'text-gray-200',
          overlay: 'bg-black/50',
          accent: 'border-l-4 border-red-600'
        };
    }
  };

  const getDynamicFontSizes = () => {
    const isPortrait = data.aspectRatio === '9:16';
    const isSquare = data.aspectRatio === '4:5';
    
    // Base sizes
    let headlineBase = isPortrait ? 28 : isSquare ? 32 : 42;
    let sublineBase = isPortrait ? 16 : isSquare ? 18 : 24;
    let bannerBase = isPortrait ? 18 : isSquare ? 22 : 28;

    // Adjust based on length (longer text = smaller font)
    const headlineLen = data.headline.length;
    if (headlineLen > 150) headlineBase *= 0.5;
    else if (headlineLen > 100) headlineBase *= 0.6;
    else if (headlineLen > 70) headlineBase *= 0.7;
    else if (headlineLen > 40) headlineBase *= 0.85;
    
    const sublineLen = data.subline.length;
    if (sublineLen > 250) sublineBase *= 0.6;
    else if (sublineLen > 150) sublineBase *= 0.75;
    else if (sublineLen > 100) sublineBase *= 0.85;

    const bannerLen = data.banner.length;
    if (bannerLen > 20) bannerBase *= 0.8;
    else if (bannerLen > 15) bannerBase *= 0.9;

    return {
      headline: `${Math.round(headlineBase)}px`,
      subline: `${Math.round(sublineBase)}px`,
      banner: `${Math.round(bannerBase)}px`,
      watermark: isPortrait ? '12px' : '16px'
    };
  };

  const fontSizes = getDynamicFontSizes();
  const styles = getStyleClasses();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-vietnam selection:bg-red-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/20">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Nàng & Thế Giới <span className="text-red-500">Studio</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={exportImage}
              disabled={!data.generatedBackground}
              className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full font-semibold text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              Xuất PNG
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Editor */}
        <div className="lg:col-span-5 space-y-6">
          {/* Image Uploaders */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
              Hình ảnh bản tin ({data.images.length}/4)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.images.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-800 group">
                  <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              
              {data.images.length < 4 && (
                <div className="relative aspect-square rounded-xl border-2 border-dashed border-zinc-800 hover:border-red-500/50 transition-colors bg-zinc-900 overflow-hidden">
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                    <Upload size={20} className="mb-1" />
                    <span className="text-[10px]">Thêm ảnh</span>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 italic">Tải lên tối đa 4 ảnh để AI trộn thành bố cục chuyên nghiệp.</p>
          </div>

          {/* Text Inputs */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Type size={18} className="text-red-500" />
              <h2 className="font-bold">Nội dung văn bản</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Dòng tin (Banner)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_TEXTS.map(text => (
                    <button 
                      key={text}
                      onClick={() => setData(prev => ({ ...prev, banner: text }))}
                      className={cn(
                        "text-[10px] px-2 py-1 rounded border transition-colors",
                        data.banner === text ? "bg-red-600 border-red-600 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      )}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <input 
                  type="text" 
                  value={data.banner}
                  onChange={e => setData(prev => ({ ...prev, banner: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Tiêu đề (Headline)</label>
                <textarea 
                  value={data.headline}
                  onChange={e => setData(prev => ({ ...prev, headline: e.target.value }))}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Mô tả (Sub-line)</label>
                <textarea 
                  value={data.subline}
                  onChange={e => setData(prev => ({ ...prev, subline: e.target.value }))}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Watermark</label>
                <input 
                  type="text" 
                  value={data.watermark}
                  onChange={e => setData(prev => ({ ...prev, watermark: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 space-y-6">
            <div className="flex items-center gap-2">
              <Settings size={18} className="text-red-500" />
              <h2 className="font-bold">Cấu hình thiết kế</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 flex items-center gap-2">
                  <Layout size={14} /> Tỉ lệ khung hình
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['16:9', '4:5', '9:16'] as AspectRatio[]).map(ratio => (
                    <button 
                      key={ratio}
                      onClick={() => setData(prev => ({ ...prev, aspectRatio: ratio }))}
                      className={cn(
                        "py-2 rounded-lg text-xs font-semibold border transition-all",
                        data.aspectRatio === ratio ? "bg-white text-black border-white" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500"
                      )}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 flex items-center gap-2">
                  <Sparkles size={14} /> Phong cách (Preset)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Bình thường', 'Đỏ Tin Nóng', 'Trắng Thanh Lịch', 'Điện Ảnh Tối', 'Phong Cách Thăm Dò'] as StylePreset[]).map(preset => (
                    <button 
                      key={preset}
                      onClick={() => setData(prev => ({ ...prev, style: preset }))}
                      className={cn(
                        "py-2 rounded-lg text-xs font-semibold border transition-all",
                        data.style === preset ? "bg-red-600 text-white border-red-600" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500"
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-2 flex items-center gap-2">
                  <ImageIcon size={14} /> Chủ đề AI (Template)
                </label>
                <div className="space-y-2">
                  {PROMPT_TEMPLATES.map(template => (
                    <button 
                      key={template.name}
                      onClick={() => setSelectedTemplate(template)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-xs border transition-all flex items-center justify-between group",
                        selectedTemplate.name === template.name ? "bg-zinc-100 text-black border-white" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                      )}
                    >
                      <span>{template.name}</span>
                      {selectedTemplate.name === template.name && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={generateBackground}
            disabled={isGenerating}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-red-900/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="animate-spin" />
                Đang tạo bố cục...
              </>
            ) : (
              <>
                <Sparkles className="group-hover:scale-110 transition-transform" />
                Tạo bố cục AI
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Sử dụng Gemini 2.0 Flash API
          </div>

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-7">
          <div className="sticky top-24 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">Xem trước kết quả</h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Thời gian thực
              </div>
            </div>

            {/* The Canvas Area */}
            <div className="relative group">
              <div 
                ref={previewRef}
                className={cn(
                  "w-full overflow-hidden rounded-2xl shadow-2xl bg-zinc-900 relative border border-zinc-800",
                  getAspectRatioClass()
                )}
              >
                {/* Background Layer */}
                <div className="absolute inset-0">
                  {data.generatedBackground ? (
                    <img 
                      src={data.generatedBackground} 
                      className="w-full h-full object-cover" 
                      alt="Hình nền do AI tạo"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 to-zinc-950">
                      <ImageIcon size={48} className="mb-4 opacity-20" />
                      <p className="text-sm font-medium opacity-40">Tạo bố cục để xem kết quả</p>
                    </div>
                  )}
                </div>

                {/* Text Overlay Layer */}
                <AnimatePresence>
                  {data.generatedBackground && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn("absolute inset-0 flex flex-col justify-end p-6 md:p-10", styles.overlay)}
                    >
                      <div className="max-w-full space-y-4">
                        {/* Banner */}
                        <motion.div 
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          style={{ fontSize: fontSizes.banner }}
                          className={cn(
                            "inline-block px-4 py-1 font-black uppercase tracking-widest mb-2 whitespace-nowrap",
                            styles.banner
                          )}
                        >
                          {data.banner}
                        </motion.div>

                        {/* Headline */}
                        <motion.div 
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className={cn(
                            "space-y-2",
                            styles.accent
                          )}
                        >
                          <h3 
                            style={{ fontSize: fontSizes.headline }}
                            className={cn(
                              "font-black leading-[1.3] uppercase tracking-tight pl-4 break-words text-balance",
                              styles.headline
                            )}
                          >
                            {data.headline}
                          </h3>
                        </motion.div>

                        {/* Subline */}
                        <motion.p 
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          style={{ fontSize: fontSizes.subline }}
                          className={cn(
                            "font-medium leading-relaxed max-w-4xl pl-4 text-pretty",
                            styles.subline
                          )}
                        >
                          {data.subline}
                        </motion.p>

                        {/* Watermark */}
                        <div className="pt-6 flex items-center justify-end border-t border-white/10">
                          <span 
                            style={{ fontSize: fontSizes.watermark }}
                            className="font-bold text-white/70 tracking-widest uppercase whitespace-nowrap"
                          >
                            {data.watermark}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Status Overlay for Generation */}
              {isGenerating && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
                  <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col items-center gap-4">
                    <div className="relative">
                      <RefreshCw className="w-12 h-12 text-red-500 animate-spin" />
                      <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-400 animate-bounce" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-lg">Đang vẽ bố cục...</p>
                      <p className="text-xs text-zinc-500">Trí tuệ nhân tạo đang xử lý hình ảnh</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                <AlertCircle size={16} className="text-zinc-400" />
              </div>
              <div className="text-xs text-zinc-500 leading-relaxed">
                <p className="font-semibold text-zinc-300 mb-1">Mẹo thiết kế:</p>
                Sử dụng ảnh có độ phân giải cao và chủ thể rõ ràng. AI sẽ tự động tách nền và sắp xếp bố cục để tối ưu cho việc chèn văn bản phía trên.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
          <p className="text-zinc-600 text-sm">
            &copy; 2026 Nàng & Thế Giới Studio. Phát triển bởi AI Studio.
          </p>
          <div className="flex items-center justify-center gap-6">
            <a href="#" className="text-zinc-500 hover:text-white transition-colors"><ImageIcon size={20} /></a>
            <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Layout size={20} /></a>
            <a href="#" className="text-zinc-500 hover:text-white transition-colors"><Settings size={20} /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}

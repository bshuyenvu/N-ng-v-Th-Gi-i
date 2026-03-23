import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      env: process.env.NODE_ENV
    });
  });

  // API route for image generation using OpenAI DALL-E 3
  app.post('/api/generate-image', async (req, res) => {
    console.log('Received image generation request');
    try {
      const { prompt, size = '1024x1024' } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is missing');
        return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server. Please add it to your AI Studio Secrets.' });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      console.log('Calling OpenAI DALL-E 3 with prompt:', prompt.substring(0, 100) + '...');
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size as any,
        response_format: "b64_json",
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No image data returned from OpenAI');
      }

      const base64Image = response.data[0].b64_json;
      console.log('Image generated successfully');
      res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
    } catch (error: any) {
      console.error('OpenAI Error:', error);
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to generate image';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

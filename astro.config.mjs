import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Automatically detect GitHub Pages repo name if building in GitHub Actions or env
const getBasePath = () => {
  if (process.env.BASE_PATH) return process.env.BASE_PATH;
  if (process.env.GITHUB_REPOSITORY) {
    const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
    return `/${repoName}`;
  }
  return '/';
};

// https://astro.build/config
export default defineConfig({
  output: 'static',
  base: getBasePath(),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['@mediapipe/tasks-vision']
    }
  }
});

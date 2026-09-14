# 🎨 3D Artist Reference Studio & Object Generator

An interactive, client-side 3D reference studio and procedural object generator built with **Astro 5**, **Vite**, **Three.js**, **MediaPipe Web Vision**, and **Tailwind CSS**.

Runs 100% in the browser via WebGL and WebAssembly (WASM), making it completely free to host on **GitHub Pages**.

---

## 🌟 Key Features

### 📸 1. Photo to 3D Loomis Studio
- **Client-Side Face Fitting:** Upload any portrait photo to extract 478 3D facial landmarks using MediaPipe WASM (100% private, no server upload).
- **Loomis Parallel Scale Bar:** Interactive 3D measurement scale comparing actual anatomical proportions against ideal Loomis equal thirds.
- **Wireframe Cranial Cage:** 3D hairline sphere cage representing the Loomis cranial ball with side disc cutouts.
- **3D Construction Rings:** Brow ring, midline ring, coronal ring, side discs, and side crosshairs.
- **Loomis & Reilly Rhythms:** 3D floating hairline tubes for key facial structural axes and Reilly rhythm loops.
- **Studio Directional Lighting:** Real-time lighting presets (*Rembrandt Chiaroscuro*, *Caravaggio*, *Three-Point Studio*, *High-Key*, *Flat Clay*) with key light angle and contrast controls.
- **Faceted vs Smooth Shading:** Toggle flat planar faceted shading to study light/shadow planes on the face.

### 🔮 2. Procedural Geometry Generator
- Create custom 3D primitives: **Cube / Box**, **Icosphere**, **Cylinder**, **Cone**, **Torus (Donut)**, and **Möbius Strip**.
- Real-time parameter sliders for dimensions, radius, subdivisions, turns, and surface colors.
- Live mesh metadata analysis (vertices, faces, watertight status, volume estimate, bounding box dimensions).

### 📂 3. 3D Model Inspector & Exporter
- Drag-and-drop 3D file viewer supporting `.obj`, `.stl`, `.glb`, `.gltf`, and `.ply` files.
- Client-side 3D model exporters for **GLB / GLTF**, **OBJ**, and **STL** binary downloads.

---

## 🛠️ Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

---

## 🚀 Running the Project Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open your browser and navigate to **`http://localhost:4321`**.

### 3. Build for Production
```bash
npm run build
```
The compiled static website will be output to the `dist/` directory.

### 4. Preview Production Build
```bash
npm run preview
```

---

## 🌐 Deploying to GitHub Pages

### Option A: Automatic Deployment via GitHub Actions (Recommended)

This repository includes a pre-configured GitHub Actions workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Build 3D Artist Reference Studio web app"
   git push origin main
   ```

2. **Enable GitHub Actions Pages Deployment:**
   - Go to your repository on GitHub.
   - Click **Settings** ⚙️ -> **Pages** (under Code and automation).
   - Under **Build and deployment** -> **Source**, select **GitHub Actions**.

3. **View Live Site:**
   - GitHub Actions will automatically build the site and deploy it.
   - Your live site will be accessible at:
     ```
     https://<your-github-username>.github.io/<your-repository-name>/
     ```

> 💡 **Note on Repository Base Paths:**
> If your repository is hosted at `https://<username>.github.io/<repo-name>/` (not a root domain), update `astro.config.mjs`:
> ```javascript
> export default defineConfig({
>   site: 'https://<username>.github.io',
>   base: '/<repo-name>',
>   // ...
> });
> ```

---

### Option B: Manual Deployment with `gh-pages` CLI

If you prefer building locally and pushing the `dist/` folder manually:

1. **Install `gh-pages`:**
   ```bash
   npm install -D gh-pages
   ```

2. **Add a deploy script to `package.json`:**
   ```json
   "scripts": {
     "build": "astro build",
     "deploy": "astro build && gh-pages -d dist"
   }
   ```

3. **Run the deploy command:**
   ```bash
   npm run deploy
   ```

---

## 📂 Project Structure

```
digital-drawing-tools/
├── .github/
│   └── workflows/
│       └── deploy.yml            # Automated GitHub Pages CI/CD workflow
├── public/
│   └── models/
│       ├── canonical_face_model.obj  # Base canonical 468-vertex 3D face mesh
│       └── face_landmarker.task     # MediaPipe 3D face landmarker WASM model
├── src/
│   ├── components/
│   │   ├── AppTabs.tsx            # Main tab navigation bar
│   │   ├── PhotoHeadStudio.tsx    # Tab 1: Photo-fitted 3D Loomis studio
│   │   ├── ProceduralGenerator.tsx # Tab 2: 3D primitive geometry builder
│   │   ├── ModelInspector.tsx     # Tab 3: 3D model parser & metadata inspector
│   │   └── ThreeViewport.tsx      # Reusable 60 FPS Three.js WebGL canvas
│   ├── utils/
│   │   ├── landmarkIndices.ts    # MediaPipe 468 vertex index mappings
│   │   ├── portraitProcessor.ts  # OBJ parser, WASM landmark fitting & scale math
│   │   ├── guideGenerator.ts     # 3D tube geometry builders & lighting shaders
│   │   └── meshGenerator.ts      # Primitive builders, metadata & GLTF/OBJ exporters
│   ├── pages/
│   │   └── index.astro           # Astro SSG entry page
│   └── styles/
│       └── global.css            # Tailwind CSS v4 directives
├── astro.config.mjs              # Astro & Vite configuration
├── package.json
└── tsconfig.json
```

---

## 📄 License

MIT License. Feel free to use, modify, and distribute for personal or commercial drawing reference projects.


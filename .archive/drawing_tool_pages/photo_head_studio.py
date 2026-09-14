"""
Photo to 3D Loomis Studio Page.
Interactive Gradio UI tab for generating 3D face reference models with 
Loomis 3D Parallel Measurement Scale, Wireframe Cranial Cage, 3D Construction Rings,
Reilly rhythm loops, Planar Face Shading, and 3D Studio Directional Lighting.
"""

import os
import gradio as gr
import trimesh
from .utils import portrait_processor, guide_generator, mesh_generator

def process_head_studio(
    photo_input,
    mesh_source,
    show_scale_bar,
    show_wireframe_cage,
    show_rings,
    show_loomis_lines,
    show_reilly_rhythms,
    show_planes,
    guide_mode,
    face_color,
    light_preset,
    light_angle,
    light_contrast,
    shading_style,
    loomis_color,
    reilly_color,
    export_fmt
):
    """Generate 3D Loomis face reference model and return GLB path for viewport display."""
    canonical_face = portrait_processor.load_canonical_mesh()
    landmarks_detected = False
    
    # 1. Process Photo Landmarks if provided
    face_mesh = canonical_face.copy()
    if mesh_source == "Photo-Fitted Face" and photo_input is not None:
        photo_landmarks = portrait_processor.extract_landmarks_from_image(photo_input)
        if photo_landmarks is not None:
            face_mesh = portrait_processor.deform_face_mesh(face_mesh, photo_landmarks)
            landmarks_detected = True

    # Preserve exact 468-vertex mesh topology for all landmark and guide generation math
    guide_face_mesh = face_mesh.copy()

    # 2. Base Face Material & Planar Shading
    if show_planes:
        face_surface = guide_generator.apply_planar_shading(face_mesh)
    else:
        face_surface = mesh_generator.apply_color(face_mesh, face_color)

    # 3. Apply 3D Studio Directional Lighting Shader (Faceted vs Smooth)
    is_faceted = (shading_style == "Faceted / Flat-Shaded")
    lit_face = guide_generator.apply_studio_lighting(
        mesh=face_surface,
        preset=light_preset,
        light_angle_deg=float(light_angle),
        light_contrast=float(light_contrast),
        flat_shading=is_faceted
    )

    scene_components = [lit_face]

    # 4. Translucent 3D Hairline Wireframe Cranial Cage (Uses guide_face_mesh 468 vertices)
    if show_wireframe_cage:
        wireframe_tubes = guide_generator.generate_wireframe_cage_meshes(guide_face_mesh, cage_color="#38bdf8", wire_radius=0.012)
        scene_components.extend(wireframe_tubes)

    # 5. 3D Construction Rings (Brow, Midline, Coronal, Side Discs)
    if show_rings:
        ring_meshes = guide_generator.generate_construction_ring_meshes(
            face_mesh=guide_face_mesh,
            brow_color="#facc15",
            midline_color="#f87171",
            coronal_color="#4ade80",
            side_disc_color="#c084fc"
        )
        scene_components.extend(ring_meshes)

    # 6. Loomis 3D Parallel Measurement Scale Bar & Ticks
    if show_scale_bar:
        scale_meshes = guide_generator.generate_loomis_scale_bar_meshes(
            face_mesh=guide_face_mesh,
            bar_color="#fbbf24",
            detected_color="#fbbf24",
            ideal_color="#38bdf8"
        )
        scene_components.extend(scale_meshes)

    # 7. Face Lines & Reilly Rhythm Loops
    if (show_loomis_lines or show_reilly_rhythms) and guide_mode in ["3D Floating Tubes", "Both"]:
        tubes = guide_generator.generate_guide_tubes(
            vertices=guide_face_mesh.vertices,
            show_loomis=show_loomis_lines,
            show_reilly=show_reilly_rhythms,
            loomis_color=loomis_color,
            reilly_color=reilly_color
        )
        scene_components.extend(tubes)

    # Combine all elements into single 3D scene
    final_scene = trimesh.util.concatenate(scene_components)
    
    # Export to requested format
    fmt = export_fmt.lower()
    filepath = mesh_generator.export_mesh_to_file(final_scene, fmt=fmt)
    glb_preview_path = mesh_generator.export_mesh_to_file(final_scene, fmt="glb")
    
    info = mesh_generator.get_mesh_info(final_scene)
    
    status_str = "Custom Photo Features Extracted ✅" if landmarks_detected else ("Default Canonical Face Model Used ℹ️")
    
    metadata_md = f"""
    ### 🎨 3D Loomis Reference Metadata
    - **Landmark Detection Status:** {status_str}
    - **Mesh Source:** `{mesh_source}`
    - **Lighting Studio:** `{light_preset}`
    - **Key Light Angle:** `{light_angle}°`
    - **Scale Bar (Measured vs Ideal):** `{'Enabled ✅' if show_scale_bar else 'Disabled ❌'}`
    - **Wireframe Cranial Cage:** `{'Enabled ✅' if show_wireframe_cage else 'Disabled ❌'}`
    - **3D Construction Rings:** `{'Enabled ✅' if show_rings else 'Disabled ❌'}`
    - **Total Vertices:** `{info['vertices']:,}`
    - **Total Faces:** `{info['faces']:,}`
    - **Bounding Box (W × H × D):** `{info['dimensions'][0]} × {info['dimensions'][1]} × {info['dimensions'][2]}`
    """
    
    return glb_preview_path, metadata_md, filepath


def render():
    """Render the Photo to 3D Loomis Studio UI layout."""
    gr.Markdown(
        """
        ## 📸 3D Loomis Proportion & Reference Studio
        Upload a portrait photo to map facial landmarks to a 3D face model with an interactive **Loomis Parallel Scale Bar** (Measured Anatomy vs Ideal Thirds), 
        a **3D Wireframe Cranial Cage**, **3D Construction Rings**, and **Studio Directional Lighting**.
        """
    )
    
    with gr.Row():
        # Left Column: Inputs & Controls
        with gr.Column(scale=1):
            photo_input = gr.Image(
                type="filepath",
                label="Upload Portrait Photo (Optional)",
            )
            
            mesh_source = gr.Dropdown(
                choices=[
                    "Photo-Fitted Face",
                    "Default Canonical Face"
                ],
                value="Photo-Fitted Face",
                label="Mesh Model Target",
            )

            gr.Markdown("### 💡 3D Studio Lighting & Shading")
            with gr.Row():
                light_preset = gr.Dropdown(
                    choices=[
                        "Three-Point Studio",
                        "Rembrandt Lighting (Dramatic Chiaroscuro)",
                        "Caravaggio Extreme Chiaroscuro",
                        "High-Key Studio (Bright & Soft)",
                        "Flat Studio Clay"
                    ],
                    value="Rembrandt Lighting (Dramatic Chiaroscuro)",
                    label="Lighting Preset",
                )
                light_angle = gr.Slider(
                    minimum=0.0,
                    maximum=360.0,
                    value=45.0,
                    step=5.0,
                    label="Key Light Angle (Degrees)"
                )
                light_contrast = gr.Slider(
                    minimum=0.5,
                    maximum=5.0,
                    value=2.0,
                    step=0.1,
                    label="Light Contrast Boost (Chiaroscuro)"
                )

            with gr.Row():
                shading_style = gr.Radio(
                    choices=["Faceted / Flat-Shaded", "Smooth-Shaded"],
                    value="Faceted / Flat-Shaded",
                    label="Mesh Shading Style (Facets vs Smooth)",
                )

            gr.Markdown("### 📏 Loomis Parallel Scale & Cranial Cage")
            with gr.Row():
                show_scale_bar = gr.Checkbox(value=True, label="Loomis Parallel Scale Bar")
                show_wireframe_cage = gr.Checkbox(value=True, label="Wireframe Cranial Cage")

            with gr.Row():
                show_rings = gr.Checkbox(value=True, label="Construction Rings (Brow, Midline, Coronal)")
                show_planes = gr.Checkbox(value=True, label="Planar Face Shading")

            gr.Markdown("### 📐 Face Overlay Guides")
            with gr.Row():
                show_loomis_lines = gr.Checkbox(value=True, label="Loomis Face Axis")
                show_reilly_rhythms = gr.Checkbox(value=True, label="Reilly Rhythm Loops")

            guide_mode = gr.Radio(
                choices=["3D Floating Tubes", "Surface Color Planes", "Both"],
                value="3D Floating Tubes",
                label="Overlay Guide Presentation",
            )
            
            with gr.Row():
                face_color = gr.ColorPicker(value="#f4e6d3", label="Studio Clay Face Tone")
                loomis_color = gr.ColorPicker(value="#facc15", label="Loomis Line Color")
                reilly_color = gr.ColorPicker(value="#38bdf8", label="Reilly Rhythm Color")

            export_fmt = gr.Radio(
                choices=["GLB", "OBJ", "STL"],
                value="GLB",
                label="Export Format",
            )
            
            build_btn = gr.Button("🚀 Build 3D Reference Head", variant="primary")

        # Right Column: Viewport & Download
        with gr.Column(scale=2):
            model_viewport = gr.Model3D(label="3D Rotatable Reference Viewport", height=520)
            metadata_output = gr.Markdown(value="Click **Build 3D Reference Head** to render interactive model.")
            download_file = gr.File(label="Download 3D Reference Model")

    inputs_list = [
        photo_input, mesh_source,
        show_scale_bar, show_wireframe_cage, show_rings,
        show_loomis_lines, show_reilly_rhythms, show_planes,
        guide_mode, face_color, light_preset, light_angle, light_contrast,
        shading_style, loomis_color, reilly_color, export_fmt
    ]
    outputs_list = [model_viewport, metadata_output, download_file]

    # Manual Build Button Click
    build_btn.click(fn=process_head_studio, inputs=inputs_list, outputs=outputs_list)

    # Live Interactive Viewport Updates when controls change
    light_preset.change(fn=process_head_studio, inputs=inputs_list, outputs=outputs_list)
    light_angle.release(fn=process_head_studio, inputs=inputs_list, outputs=outputs_list)
    light_contrast.release(fn=process_head_studio, inputs=inputs_list, outputs=outputs_list)
    shading_style.change(fn=process_head_studio, inputs=inputs_list, outputs=outputs_list)
    face_color.change(fn=process_head_studio, inputs=inputs_list, outputs=outputs_list)
    show_planes.change(fn=process_head_studio, inputs=inputs_list, outputs=outputs_list)
    show_scale_bar.change(fn=process_head_studio, inputs=inputs_list, outputs=outputs_list)
    show_wireframe_cage.change(fn=process_head_studio, inputs=inputs_list, outputs=outputs_list)
    show_rings.change(fn=process_head_studio, inputs=inputs_list, outputs=outputs_list)

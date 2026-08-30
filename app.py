import gradio as gr
import drawing_tool_pages.basic_shapes as basic_shapes
import drawing_tool_pages.model_inspector as model_inspector

# Building Gradio Interface
with gr.Blocks(title="3D Studio & Mesh Generator") as app:

    gr.Markdown(
        """
        # 🎨 3D Object Studio & Procedural Generator
        Interactive 3D viewport and shape generator built with Gradio and `trimesh`.
        *Rotate with Left Click | Pan with Right Click / Shift+Click | Zoom with Scroll*
        """
    )

    with gr.Tabs():
        # --- TAB 1: PROCEDURAL GENERATOR ---
        with gr.Tab("🔮 Procedural Generator"):
            basic_shapes.render()

        # --- TAB 2: MODEL UPLOADER & INSPECTOR ---
        with gr.Tab("📂 Model Viewer & Inspector"):
            model_inspector.render()

if __name__ == "__main__":
    app.launch(server_name="0.0.0.0", server_port=7860, theme=gr.themes.Soft(), share=False)

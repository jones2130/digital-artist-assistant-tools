import gradio as gr
import drawing_tool_pages.basic_shapes as basic_shapes
import drawing_tool_pages.model_inspector as model_inspector
import drawing_tool_pages.photo_head_studio as photo_head_studio

# Building Gradio Interface
with gr.Blocks(title="3D Studio & Artist Reference Generator") as app:

    gr.Markdown(
        """
        # 🎨 3D Artist Reference Studio & Object Generator
        Interactive 3D viewport, **Loomis & Reilly Head Studio**, and shape generator.
        *Rotate with Left Click | Pan with Right Click / Shift+Click | Zoom with Scroll*
        """
    )

    with gr.Tabs():
        # --- TAB 1: PHOTO TO 3D LOOMIS STUDIO ---
        with gr.Tab("📸 Photo to 3D Loomis Studio"):
            photo_head_studio.render()

        # --- TAB 2: PROCEDURAL GENERATOR ---
        with gr.Tab("🔮 Procedural Generator"):
            basic_shapes.render()

        # --- TAB 3: MODEL UPLOADER & INSPECTOR ---
        with gr.Tab("📂 Model Viewer & Inspector"):
            model_inspector.render()

if __name__ == "__main__":
    app.launch(server_name="0.0.0.0", server_port=7860, theme=gr.themes.Soft(), share=False)

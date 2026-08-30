import gradio as gr
from .utils import mesh_generator

def inspect_uploaded_model(file_obj):
    """Process an uploaded 3D model file and return preview and metadata."""
    if file_obj is None:
        return None, "Upload a 3D file to view metadata.", None

    filepath = file_obj.name
    try:
        info = mesh_generator.get_mesh_info(filepath)
        watertight_str = "Yes ✅" if info["is_watertight"] else "No ⚠️"
        vol_str = f"{info['volume']:.3f} units³" if info['volume'] is not None else "N/A"
        dim = info["dimensions"]

        metadata_md = f"""
        ### 🔍 Model Properties
        - **Filename:** `{filepath.split('/')[-1]}`
        - **Vertices:** `{info['vertices']:,}`
        - **Faces:** `{info['faces']:,}`
        - **Watertight Mesh:** {watertight_str}
        - **Volume:** `{vol_str}`
        - **Bounding Box Dimensions:** `{dim[0]} × {dim[1]} × {dim[2]}`
        """
        return filepath, metadata_md, filepath
    except Exception as e:
        return None, f"⚠️ Error loading 3D file: {str(e)}", None

def render():
    """Render the Model Viewer & Inspector tab components."""
    with gr.Row():
        with gr.Column(scale=1):
            upload_file = gr.File(
                label="Upload 3D File (.obj, .stl, .glb, .gltf, .ply)",
                file_types=[".obj", ".stl", ".glb", ".gltf", ".ply"],
            )
            inspect_btn = gr.Button("🔍 Inspect & Load Model", variant="primary")
            upload_metadata = gr.Markdown(value="Upload a file to inspect metadata.")

        with gr.Column(scale=2):
            upload_viewport = gr.Model3D(label="Interactive 3D Inspector", height=450)
            upload_download = gr.File(label="Download Processed Model")

    inspect_btn.click(
        fn=inspect_uploaded_model,
        inputs=[upload_file],
        outputs=[upload_viewport, upload_metadata, upload_download],
    )


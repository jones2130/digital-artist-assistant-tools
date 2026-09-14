from .utils import mesh_generator as mesh_generator

import gradio as gr

def update_shape_controls(shape_name):
    """Dynamically show/hide parameter sliders based on selected 3D shape."""
    return (
        gr.update(visible=(shape_name == "Cube")),          # cube_group
        gr.update(visible=(shape_name == "Sphere")),        # sphere_group
        gr.update(visible=(shape_name == "Cylinder")),      # cylinder_group
        gr.update(visible=(shape_name == "Cone")),          # cone_group
        gr.update(visible=(shape_name == "Torus")),         # torus_group
        gr.update(visible=(shape_name == "Möbius Strip")),  # mobius_group
    )

def generate_3d_model(
    shape_name,
    color,
    export_fmt,
    # Cube
    cube_x, cube_y, cube_z,
    # Sphere
    sphere_radius, sphere_subdiv,
    # Cylinder
    cyl_radius, cyl_height, cyl_sections,
    # Cone
    cone_radius, cone_height, cone_sections,
    # Torus
    torus_major_r, torus_minor_r, torus_major_sec, torus_minor_sec,
    # Mobius
    mobius_width, mobius_turns, mobius_res_u
):
    """Generate 3D mesh based on user inputs and return file path and metadata."""
    if shape_name == "Cube":
        mesh = mesh_generator.create_cube(size_x=cube_x, size_y=cube_y, size_z=cube_z, color=color)
    elif shape_name == "Sphere":
        mesh = mesh_generator.create_sphere(radius=sphere_radius, subdivisions=sphere_subdiv, color=color)
    elif shape_name == "Cylinder":
        mesh = mesh_generator.create_cylinder(radius=cyl_radius, height=cyl_height, sections=cyl_sections, color=color)
    elif shape_name == "Cone":
        mesh = mesh_generator.create_cone(radius=cone_radius, height=cone_height, sections=cone_sections, color=color)
    elif shape_name == "Torus":
        mesh = mesh_generator.create_torus(
            major_radius=torus_major_r, minor_radius=torus_minor_r,
            major_sections=torus_major_sec, minor_sections=torus_minor_sec,
            color=color
        )
    elif shape_name == "Möbius Strip":
        mesh = mesh_generator.create_mobius(
            strip_width=mobius_width, num_turns=mobius_turns, res_u=mobius_res_u, color=color
        )
    else:
        mesh = mesh_generator.create_cube(color=color)

    # Export to selected format
    fmt = export_fmt.lower()
    filepath = mesh_generator.export_mesh_to_file(mesh, fmt=fmt)
    info = mesh_generator.get_mesh_info(mesh)

    watertight_str = "Yes ✅" if info["is_watertight"] else "No (Open Surface) ⚠️"
    vol_str = f"{info['volume']:.3f} units³" if info['volume'] is not None else "N/A"
    dim = info["dimensions"]
    bounds_min = info["bounds_min"]
    bounds_max = info["bounds_max"]

    metadata_md = f"""
    ### 📊 Mesh Metadata
    - **Vertices:** `{info['vertices']:,}`
    - **Faces:** `{info['faces']:,}`
    - **Watertight:** {watertight_str}
    - **Volume:** `{vol_str}`
    - **Dimensions (W × H × D):** `{dim[0]} × {dim[1]} × {dim[2]}`
    - **Bounding Box Min:** `{bounds_min}`
    - **Bounding Box Max:** `{bounds_max}`
    """

    return filepath, metadata_md, filepath

def render():
    """Render procedural generator tab UI components and event bindings."""
    with gr.Row():
        # Left Column: Shape Controls
        with gr.Column(scale=1):
            shape_dropdown = gr.Dropdown(
                choices=["Cube", "Sphere", "Cylinder", "Cone", "Torus", "Möbius Strip"],
                value="Sphere",
                label="Select 3D Primitive",
            )
            color_picker = gr.ColorPicker(value="#3b82f6", label="Mesh Color")
            export_format = gr.Radio(
                choices=["GLB", "OBJ", "STL"],
                value="GLB",
                label="Export Format",
            )

            # Dynamic Shape Parameters
            with gr.Group(visible=False) as cube_group:
                cube_x = gr.Slider(0.1, 10.0, value=1.0, step=0.1, label="Width (X)")
                cube_y = gr.Slider(0.1, 10.0, value=1.0, step=0.1, label="Height (Y)")
                cube_z = gr.Slider(0.1, 10.0, value=1.0, step=0.1, label="Depth (Z)")

            with gr.Group(visible=True) as sphere_group:
                sphere_radius = gr.Slider(0.1, 5.0, value=1.0, step=0.1, label="Radius")
                sphere_subdiv = gr.Slider(1, 5, value=3, step=1, label="Subdivisions (Quality)")

            with gr.Group(visible=False) as cylinder_group:
                cyl_radius = gr.Slider(0.1, 5.0, value=1.0, step=0.1, label="Radius")
                cyl_height = gr.Slider(0.1, 10.0, value=2.0, step=0.1, label="Height")
                cyl_sections = gr.Slider(8, 64, value=32, step=4, label="Radial Sections")

            with gr.Group(visible=False) as cone_group:
                cone_radius = gr.Slider(0.1, 5.0, value=1.0, step=0.1, label="Base Radius")
                cone_height = gr.Slider(0.1, 10.0, value=2.0, step=0.1, label="Height")
                cone_sections = gr.Slider(8, 64, value=32, step=4, label="Radial Sections")

            with gr.Group(visible=False) as torus_group:
                torus_major_r = gr.Slider(0.5, 5.0, value=2.0, step=0.1, label="Major Radius (Ring)")
                torus_minor_r = gr.Slider(0.1, 2.0, value=0.5, step=0.05, label="Minor Radius (Tube)")
                torus_major_sec = gr.Slider(8, 64, value=32, step=4, label="Ring Segments")
                torus_minor_sec = gr.Slider(4, 32, value=16, step=2, label="Tube Segments")

            with gr.Group(visible=False) as mobius_group:
                mobius_width = gr.Slider(0.1, 2.0, value=0.5, step=0.05, label="Strip Width")
                mobius_turns = gr.Slider(1, 4, value=1, step=1, label="Twist Turns")
                mobius_res_u = gr.Slider(30, 200, value=100, step=10, label="Resolution")

            generate_btn = gr.Button("🚀 Generate 3D Model", variant="primary")

        # Right Column: 3D Viewport & Info
        with gr.Column(scale=2):
            model_viewport = gr.Model3D(label="3D Viewport", height=450)
            metadata_output = gr.Markdown(value="Click **Generate 3D Model** to build preview.")
            download_file = gr.File(label="Download 3D File")

    # Update shape controls visibility on dropdown change
    shape_dropdown.change(
        fn=update_shape_controls,
        inputs=[shape_dropdown],
        outputs=[cube_group, sphere_group, cylinder_group, cone_group, torus_group, mobius_group],
    )

    # Generate button click
    generate_btn.click(
        fn=generate_3d_model,
        inputs=[
            shape_dropdown, color_picker, export_format,
            cube_x, cube_y, cube_z,
            sphere_radius, sphere_subdiv,
            cyl_radius, cyl_height, cyl_sections,
            cone_radius, cone_height, cone_sections,
            torus_major_r, torus_minor_r, torus_major_sec, torus_minor_sec,
            mobius_width, mobius_turns, mobius_res_u
        ],
        outputs=[model_viewport, metadata_output, download_file],
    )
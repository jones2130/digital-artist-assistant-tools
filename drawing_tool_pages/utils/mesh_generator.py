import os
import tempfile
import numpy as np
import trimesh

# Directory for storing generated 3D files for Gradio preview
TEMP_DIR = tempfile.mkdtemp(prefix="gradio_3d_")


def hex_to_rgba(hex_color: str, alpha: float = 1.0):
    """Convert hex color string (e.g. #3b82f6) to RGBA uint8 list [0..255]."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return [r, g, b, int(alpha * 255)]
    return [100, 150, 240, int(alpha * 255)]


def apply_color(mesh: trimesh.Trimesh, color_hex: str):
    """Apply uniform color to a mesh."""
    rgba = hex_to_rgba(color_hex)
    mesh.visual.face_colors = rgba
    return mesh


def create_cube(size_x=1.0, size_y=1.0, size_z=1.0, color="#3b82f6"):
    """Generate a box/cube mesh."""
    mesh = trimesh.creation.box(extents=[size_x, size_y, size_z])
    return apply_color(mesh, color)


def create_sphere(radius=1.0, subdivisions=3, color="#ef4444"):
    """Generate an icosphere mesh."""
    mesh = trimesh.creation.icosphere(subdivisions=int(subdivisions), radius=radius)
    return apply_color(mesh, color)


def create_cylinder(radius=1.0, height=2.0, sections=32, color="#10b981"):
    """Generate a cylinder mesh."""
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=int(sections))
    return apply_color(mesh, color)


def create_cone(radius=1.0, height=2.0, sections=32, color="#f59e0b"):
    """Generate a cone mesh."""
    mesh = trimesh.creation.cone(radius=radius, height=height, sections=int(sections))
    return apply_color(mesh, color)


def create_torus(major_radius=2.0, minor_radius=0.5, major_sections=32, minor_sections=16, color="#8b5cf6"):
    """Generate a torus (donut) mesh."""
    mesh = trimesh.creation.torus(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_sections=int(major_sections),
        minor_sections=int(minor_sections),
    )
    return apply_color(mesh, color)


def create_mobius(strip_width=0.5, num_turns=1, res_u=100, res_v=20, color="#ec4899"):
    """Generate a Möbius strip parametric surface."""
    u = np.linspace(0, 2 * np.pi * num_turns, int(res_u))
    v = np.linspace(-strip_width / 2.0, strip_width / 2.0, int(res_v))
    u_grid, v_grid = np.meshgrid(u, v)

    # Parametric equations for Mobius strip
    x = (1 + v_grid / 2.0 * np.cos(u_grid / 2.0)) * np.cos(u_grid)
    y = (1 + v_grid / 2.0 * np.cos(u_grid / 2.0)) * np.sin(u_grid)
    z = v_grid / 2.0 * np.sin(u_grid / 2.0)

    # Generate quad faces and convert to triangles
    vertices = np.column_stack((x.flatten(), y.flatten(), z.flatten()))
    faces = []
    rows, cols = int(res_v), int(res_u)

    for i in range(rows - 1):
        for j in range(cols - 1):
            p1 = i * cols + j
            p2 = p1 + 1
            p3 = (i + 1) * cols + j
            p4 = p3 + 1
            faces.append([p1, p2, p3])
            faces.append([p2, p4, p3])

    mesh = trimesh.Trimesh(vertices=vertices, faces=np.array(faces))
    return apply_color(mesh, color)


def export_mesh_to_file(mesh: trimesh.Trimesh, fmt: str = "glb") -> str:
    """Export a trimesh mesh to a file (default GLB) and return the file path."""
    filename = f"mesh_{id(mesh)}.{fmt}"
    filepath = os.path.join(TEMP_DIR, filename)

    if fmt in ["glb", "gltf"]:
        # Export scene containing mesh to retain materials/colors in GLTF/GLB format
        scene = trimesh.Scene(mesh)
        data = scene.export(file_type=fmt)
        with open(filepath, "wb") as f:
            f.write(data)
    elif fmt == "obj":
        data = mesh.export(file_type="obj")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(data)
    elif fmt == "stl":
        mesh.export(filepath, file_type="stl")
    else:
        mesh.export(filepath)

    return filepath


def get_mesh_info(mesh_or_path) -> dict:
    """Extract metadata information from a mesh object or file path."""
    if isinstance(mesh_or_path, str):
        mesh = trimesh.load(mesh_or_path, force="mesh")
    else:
        mesh = mesh_or_path

    if isinstance(mesh, trimesh.Scene):
        mesh = mesh.dump(concatenate=True)

    bounds = mesh.bounds if mesh.bounds is not None else np.zeros((2, 3))
    dimensions = bounds[1] - bounds[0] if bounds is not None else [0, 0, 0]

    return {
        "vertices": len(mesh.vertices),
        "faces": len(mesh.faces),
        "is_watertight": bool(mesh.is_watertight),
        "volume": float(mesh.volume) if mesh.is_watertight else None,
        "bounds_min": [round(float(v), 3) for v in bounds[0]],
        "bounds_max": [round(float(v), 3) for v in bounds[1]],
        "dimensions": [round(float(v), 3) for v in dimensions],
    }


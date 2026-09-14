"""
3D Mesh Generation & File Export Utilities.
Provides procedural geometry builders, color assignment, and subtle GLB material post-processing.
"""

import os
import tempfile
import struct
import json
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


def create_cone(radius=1.0, height=2.0, sections=32, color="#f5e6d3"):
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


def fix_glb_emissive(glb_bytes: bytes, emissive_rgb=[0.05, 0.04, 0.03]) -> bytes:
    """Post-process GLB binary to set PBR studio material properties and doubleSided flag."""
    try:
        magic, version, total_len = struct.unpack("<III", glb_bytes[:12])
        chunk_len, chunk_type = struct.unpack("<II", glb_bytes[12:20])
        json_bytes = glb_bytes[20 : 20 + chunk_len]
        bin_bytes = glb_bytes[20 + chunk_len :]

        gltf_data = json.loads(json_bytes.decode("utf-8"))

        # Remove unlit extension if present so Three.js renders 3D PBR vertex normal lighting
        if "extensionsUsed" in gltf_data and "KHR_materials_unlit" in gltf_data["extensionsUsed"]:
            gltf_data["extensionsUsed"].remove("KHR_materials_unlit")

        if "materials" in gltf_data:
            for mat in gltf_data["materials"]:
                mat["doubleSided"] = True
                if "extensions" in mat and "KHR_materials_unlit" in mat["extensions"]:
                    del mat["extensions"]["KHR_materials_unlit"]
                if "pbrMetallicRoughness" in mat:
                    mat["pbrMetallicRoughness"]["baseColorFactor"] = [1.0, 1.0, 1.0, 1.0]
                    mat["pbrMetallicRoughness"]["roughnessFactor"] = 0.45
                    mat["pbrMetallicRoughness"]["metallicFactor"] = 0.0
                mat["emissiveFactor"] = emissive_rgb
        else:
            gltf_data["materials"] = [
                {
                    "pbrMetallicRoughness": {
                        "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
                        "roughnessFactor": 0.45,
                        "metallicFactor": 0.0,
                    },
                    "emissiveFactor": emissive_rgb,
                    "doubleSided": True,
                }
            ]

        new_json_bytes = json.dumps(gltf_data).encode("utf-8")
        padding = (4 - (len(new_json_bytes) % 4)) % 4
        new_json_bytes += b" " * padding

        new_chunk_len = len(new_json_bytes)
        new_total_len = 12 + 8 + new_chunk_len + len(bin_bytes)

        new_header = struct.pack("<III", magic, version, new_total_len)
        new_chunk_header = struct.pack("<II", new_chunk_len, chunk_type)

        return new_header + new_chunk_header + new_json_bytes + bin_bytes
    except Exception as e:
        print(f"Warning: GLB emissive post-processing fallback: {e}")
        return glb_bytes


import uuid

def export_mesh_to_file(mesh: trimesh.Trimesh, fmt: str = "glb") -> str:
    """Export a trimesh mesh to a file (default GLB) with subtle studio material post-processing."""
    unique_id = uuid.uuid4().hex[:12]
    filename = f"mesh_{unique_id}.{fmt}"
    filepath = os.path.join(TEMP_DIR, filename)

    if fmt in ["glb", "gltf"]:
        scene = trimesh.Scene(mesh)
        data = scene.export(file_type=fmt)
        if isinstance(data, bytes):
            data = fix_glb_emissive(data, emissive_rgb=[0.02, 0.02, 0.02])
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

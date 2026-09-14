"""
3D Guide Line & Construction Ring Generator for Loomis Parallel Scale and Construction Rings.
Renders minimal hairline polyline line meshes for Loomis scale bar, anatomical/ideal ticks, 
brow/midline/coronal rings, side discs, wireframe cranial cage, and realistic high-contrast 3D studio lighting.
"""

import numpy as np
import trimesh
from . import landmark_indices, portrait_processor

def hex_to_rgba(hex_color: str, alpha: float = 1.0):
    """Convert hex color string to RGBA [0..255] numpy array."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return np.array([r, g, b, int(alpha * 255)], dtype=np.uint8)
    return np.array([216, 194, 167, int(alpha * 255)], dtype=np.uint8)

def apply_studio_lighting(
    mesh: trimesh.Trimesh,
    preset: str = "Three-Point Studio",
    light_angle_deg: float = 45.0,
    light_contrast: float = 1.5,
    flat_shading: bool = True
) -> trimesh.Trimesh:
    """
    Apply realistic high-contrast 3D directional key/fill/ambient studio lighting across mesh face normals.
    Supports flat faceted shading (showing individual polygon faces) or smooth interpolation.
    """
    lit_mesh = mesh.copy()
    lit_mesh.fix_normals()
    normals = lit_mesh.face_normals

    # Calculate Key light direction around the front-facing hemisphere (+Z)
    # 0° = Front, 45° = Front-Right 3/4, 90° = Side Right, 270° = Side Left, 315° = Front-Left 3/4
    rad = np.radians(light_angle_deg)
    key_dir = np.array([np.sin(rad), 0.35, np.cos(rad)])
    key_dir /= np.linalg.norm(key_dir)

    fill_dir = np.array([-np.sin(rad), -0.2, np.cos(rad)])
    fill_dir /= np.linalg.norm(fill_dir)

    if preset == "Caravaggio Extreme Chiaroscuro":
        ambient = 0.02
        key_weight, fill_weight = 1.60, 0.02
    elif preset == "Rembrandt Lighting (Dramatic Chiaroscuro)":
        ambient = 0.05
        key_weight, fill_weight = 1.45, 0.05
    elif preset == "High-Key Studio (Bright & Soft)":
        ambient = 0.65
        key_weight, fill_weight = 0.50, 0.25
    elif preset == "Flat Studio Clay":
        ambient = 1.0
        key_weight, fill_weight = 0.0, 0.0
    else:  # Three-Point Studio (High Contrast)
        ambient = 0.22
        key_weight, fill_weight = 1.15, 0.10

    key_dot = np.maximum(0.0, np.dot(normals, key_dir))
    fill_dot = np.maximum(0.0, np.dot(normals, fill_dir))

    # Apply contrast exponent to sharpen light-to-dark gradient transitions across planes
    contrast_power = max(0.5, float(light_contrast))
    key_boosted = np.power(key_dot, contrast_power)
    fill_boosted = np.power(fill_dot, contrast_power)

    intensity = ambient + key_weight * key_boosted + fill_weight * fill_boosted

    # Preserve existing face colors (planar or solid) and apply lighting intensity
    if hasattr(lit_mesh.visual, "face_colors") and len(lit_mesh.visual.face_colors) == len(lit_mesh.faces):
        current_rgba = lit_mesh.visual.face_colors.copy()
    else:
        current_rgba = np.full((len(lit_mesh.faces), 4), [244, 230, 211, 255], dtype=np.uint8)

    lit_rgb = np.clip(current_rgba[:, :3].astype(np.float32) * intensity[:, np.newaxis], 0, 255).astype(np.uint8)
    lit_mesh.visual.face_colors = np.column_stack([lit_rgb, np.full(len(lit_rgb), 255, dtype=np.uint8)])
    
    # If flat faceted shading is requested, unmerge vertices in-place and set flat face normals
    if flat_shading:
        lit_mesh.unmerge_vertices()
        lit_mesh.vertex_normals = np.repeat(lit_mesh.face_normals, 3, axis=0)
    else:
        lit_mesh.vertex_normals = lit_mesh.vertex_normals

    return lit_mesh


def build_3d_tube_from_points(points: np.ndarray, radius: float = 0.03, color_hex: str = "#3b82f6") -> list[trimesh.Trimesh]:
    """Create minimal hairline cylinder line segments between consecutive 3D points."""
    tubes = []
    rgba = hex_to_rgba(color_hex)
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i + 1]
        vec = p2 - p1
        dist = np.linalg.norm(vec)
        if dist < 1e-6:
            continue
        
        cyl = trimesh.creation.cylinder(radius=radius, height=dist, sections=4)
        
        z_axis = np.array([0.0, 0.0, 1.0])
        dir_norm = vec / dist
        
        v = np.cross(z_axis, dir_norm)
        c = np.dot(z_axis, dir_norm)
        if c < -0.9999:
            rot = trimesh.transformations.rotation_matrix(np.pi, [1, 0, 0])
        elif c > 0.9999:
            rot = np.eye(4)
        else:
            s = np.linalg.norm(v)
            vx = np.array([
                [0, -v[2], v[1]],
                [v[2], 0, -v[0]],
                [-v[1], v[0], 0]
            ])
            rot_3 = np.eye(3) + vx + np.matmul(vx, vx) * ((1 - c) / (s ** 2))
            rot = np.eye(4)
            rot[:3, :3] = rot_3

        midpoint = (p1 + p2) / 2.0
        trans = trimesh.transformations.translation_matrix(midpoint)
        cyl.apply_transform(trans @ rot)
        cyl.visual.face_colors = rgba
        tubes.append(cyl)
        
    return tubes


def generate_wireframe_cage_meshes(
    face_mesh: trimesh.Trimesh,
    cage_color: str = "#38bdf8",
    wire_radius: float = 0.012
) -> list[trimesh.Trimesh]:
    """Generate minimal hairline 3D wireframe edge lines for the cranial ball cage."""
    cranial_mesh = portrait_processor.build_wireframe_cranial_sphere_geometry(face_mesh)
    edges_pts = cranial_mesh.vertices[cranial_mesh.edges_unique]
    
    wire_tubes = []
    for edge in edges_pts:
        tubes = build_3d_tube_from_points(edge, radius=wire_radius, color_hex=cage_color)
        wire_tubes.extend(tubes)
        
    return wire_tubes


def generate_loomis_scale_bar_meshes(
    face_mesh: trimesh.Trimesh,
    bar_color: str = "#fbbf24",
    detected_color: str = "#fbbf24",
    ideal_color: str = "#38bdf8"
) -> list[trimesh.Trimesh]:
    """Generate minimal hairline 3D line meshes for the Loomis Parallel Scale Rod and Ticks."""
    scale_data = portrait_processor.compute_loomis_measurement_scale(face_mesh)
    tube_meshes = []

    # 1. Main Parallel Scale Rod (Hairline)
    tube_meshes.extend(
        build_3d_tube_from_points(scale_data["scale_bar_pts"], radius=0.04, color_hex=bar_color)
    )

    # 2. Measured Anatomy Ticks (Amber Hairline)
    for tick in scale_data["ticks_detected"]:
        tube_meshes.extend(
            build_3d_tube_from_points(tick, radius=0.03, color_hex=detected_color)
        )

    # 3. Ideal Loomis Equal-Third Ticks (Cyan Hairline)
    for tick in scale_data["ticks_ideal"]:
        tube_meshes.extend(
            build_3d_tube_from_points(tick, radius=0.03, color_hex=ideal_color)
        )

    return tube_meshes


def generate_construction_ring_meshes(
    face_mesh: trimesh.Trimesh,
    brow_color: str = "#facc15",
    midline_color: str = "#f87171",
    coronal_color: str = "#4ade80",
    side_disc_color: str = "#c084fc"
) -> list[trimesh.Trimesh]:
    """Generate minimal hairline 3D line meshes for Brow Ring, Midline Ring, Coronal Ring, and Side Discs/Crosshairs."""
    rings_data = portrait_processor.compute_construction_rings(face_mesh)
    tube_meshes = []

    # 1. Brow Ring (Yellow Hairline)
    tube_meshes.extend(
        build_3d_tube_from_points(rings_data["brow_ring_pts"], radius=0.03, color_hex=brow_color)
    )

    # 2. Midline Ring (Red Hairline)
    tube_meshes.extend(
        build_3d_tube_from_points(rings_data["midline_ring_pts"], radius=0.03, color_hex=midline_color)
    )

    # 3. Coronal Ring (Green Hairline)
    tube_meshes.extend(
        build_3d_tube_from_points(rings_data["coronal_ring_pts"], radius=0.03, color_hex=coronal_color)
    )

    # 4. Side Discs (Purple Hairline)
    for ring in rings_data["side_rings_pts"]:
        tube_meshes.extend(
            build_3d_tube_from_points(ring, radius=0.025, color_hex=side_disc_color)
        )

    # 5. Side Crosshairs (Purple Hairline)
    for cross_line in rings_data["side_cross_pts"]:
        tube_meshes.extend(
            build_3d_tube_from_points(cross_line, radius=0.02, color_hex=side_disc_color)
        )

    return tube_meshes


def generate_guide_tubes(
    vertices: np.ndarray,
    show_loomis: bool = True,
    show_reilly: bool = True,
    loomis_color: str = "#ef4444",
    reilly_color: str = "#3b82f6",
    tube_radius: float = 0.025
) -> list[trimesh.Trimesh]:
    """Generate minimal hairline 3D line meshes for Loomis structural face lines and Reilly rhythm loops."""
    guide_meshes = []
    
    if show_loomis:
        for name, indices in landmark_indices.LOOMIS_LINE_GROUPS.items():
            valid_indices = [idx for idx in indices if idx < len(vertices)]
            if len(valid_indices) >= 2:
                points = vertices[valid_indices]
                tubes = build_3d_tube_from_points(points, radius=tube_radius, color_hex=loomis_color)
                guide_meshes.extend(tubes)
                
    if show_reilly:
        for name, indices in landmark_indices.REILLY_LINE_GROUPS.items():
            valid_indices = [idx for idx in indices if idx < len(vertices)]
            if len(valid_indices) >= 2:
                points = vertices[valid_indices]
                tubes = build_3d_tube_from_points(points, radius=tube_radius, color_hex=reilly_color)
                guide_meshes.extend(tubes)
                
    return guide_meshes


def apply_planar_shading(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Colorize face planes with warm light clay reference tones matching reference render (#f4e6d3)."""
    colored_mesh = mesh.copy()
    num_faces = len(colored_mesh.faces)
    
    # Light studio clay base #f4e6d3 [244, 230, 211, 255]
    face_colors = np.full((num_faces, 4), [244, 230, 211, 255], dtype=np.uint8)
    
    # Light studio clay planar variations
    plane_colors = {
        "Forehead Central": "#f8efe4",
        "Nose Bridge": "#faf3eb",
        "Nose Sides Left": "#e6d5c2",
        "Nose Sides Right": "#e6d5c2",
        "Upper Lip Plane": "#ebd7c4",
        "Chin Plane": "#dcc6b1",
        "Left Cheek Plane": "#efe0d0",
        "Right Cheek Plane": "#efe0d0",
    }
    
    for plane_name, indices in landmark_indices.PLANAR_FACE_GROUPS.items():
        idx_set = set(indices)
        color_rgba = hex_to_rgba(plane_colors.get(plane_name, "#f4e6d3"))
        
        for face_idx, face_verts in enumerate(colored_mesh.faces):
            if sum(1 for v in face_verts if v in idx_set) >= 2:
                face_colors[face_idx] = color_rgba
                
    colored_mesh.visual.face_colors = face_colors
    return colored_mesh

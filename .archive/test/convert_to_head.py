import numpy as np
import trimesh

# MediaPipe canonical outer contour loop (hairline -> temples -> jaw -> chin) in sequence
CANONICAL_BOUNDARY_INDICES = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
]

def build_smooth_canonical_head(face_obj_path: str, output_path: str):
    face_mesh = trimesh.load(face_obj_path, process=False)
    boundary_pts = face_mesh.vertices[CANONICAL_BOUNDARY_INDICES]

    # Facial reference frames
    chin = face_mesh.vertices[152]
    glabella = face_mesh.vertices[9]
    left_ear = face_mesh.vertices[454]
    right_ear = face_mesh.vertices[234]

    face_height = np.linalg.norm(glabella - chin)
    head_width = np.linalg.norm(left_ear - right_ear)
    ear_midpoint = (left_ear + right_ear) / 2.0

    # Anatomical cranial center: placed slightly above and posterior to ear canal
    cranium_center = ear_midpoint + np.array([0, face_height * 0.15, -head_width * 0.35])
    rx = head_width * 0.52       # Half-width
    ry = face_height * 0.62      # Half-height (vertex to skull base)
    rz = head_width * 0.68       # Cranial depth (posterior reach)

    # Generate UV hemisphere grid for the rear cranium
    lat_steps, lon_steps = 14, 20
    u = np.linspace(0, np.pi, lon_steps)
    v = np.linspace(-np.pi / 2, np.pi / 2, lat_steps)

    # Posterior hemisphere points (z < 0)
    skull_verts = []
    for val_v in v:
        for val_u in u:
            # Ellipsoid equations with organic cranial taper
            x = rx * np.cos(val_v) * np.sin(val_u)
            # Taper parietal crest upward and occipital outward
            y_scale = 1.0 + (0.15 * np.cos(val_u))
            y = ry * np.sin(val_v) * y_scale
            z = -abs(rz * np.cos(val_v) * np.cos(val_u))

            pt = cranium_center + np.array([x, y, z])
            skull_verts.append(pt)

    # Add neck cylinder anchoring beneath skull down through cervical base
    neck_center = ear_midpoint + np.array([0, -face_height * 0.6, -head_width * 0.25])
    neck_radius = head_width * 0.36
    neck_verts = []
    for theta in np.linspace(0, 2 * np.pi, lon_steps, endpoint=False):
        nx = neck_radius * np.cos(theta)
        nz = neck_radius * np.sin(theta)
        neck_verts.append(neck_center + np.array([nx, -face_height * 0.4, nz]))
        neck_verts.append(neck_center + np.array([nx, 0, nz]))

    # Combine face mesh with anatomical rear shell
    all_points = np.vstack([face_mesh.vertices, skull_verts, neck_verts])
    combined_mesh = trimesh.convex.convex_hull(all_points)

    # Retain the exact canonical front face geometry, replace rear
    final_mesh = trimesh.util.concatenate([face_mesh, combined_mesh])
    final_mesh.merge_vertices()
    final_mesh.fix_normals()
    final_mesh.export(output_path)

build_smooth_canonical_head("canonical_face_model.obj", "canonical_head_model.obj")
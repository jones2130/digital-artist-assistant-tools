"""
Portrait Processor: MediaPipe landmark extraction, 3D anatomical frame calculation,
and Loomis precision scale & wireframe cranial cage construction.
"""

import os
import urllib.request
import numpy as np
import trimesh
import cv2
from PIL import Image
from scipy.spatial import KDTree
from scipy.interpolate import RBFInterpolator
from . import landmark_indices

# Paths to model OBJ files
CANONICAL_OBJ_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "test", "canonical_face_model.obj")
)
CANONICAL_HEAD_OBJ_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "test", "canonical_head_model.obj")
)

MODEL_TASK_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "utils", "face_landmarker.task")
)
MODEL_TASK_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"


def ensure_model_asset() -> str | None:
    """Ensure the MediaPipe face_landmarker.task model file is present locally."""
    if os.path.exists(MODEL_TASK_PATH):
        return MODEL_TASK_PATH
    try:
        os.makedirs(os.path.dirname(MODEL_TASK_PATH), exist_ok=True)
        print("Downloading MediaPipe face_landmarker.task model...")
        urllib.request.urlretrieve(MODEL_TASK_URL, MODEL_TASK_PATH)
        return MODEL_TASK_PATH
    except Exception as e:
        print(f"Warning: Failed to download MediaPipe model: {e}")
        return None


def load_canonical_mesh() -> trimesh.Trimesh:
    """Load default canonical face model mesh."""
    if os.path.exists(CANONICAL_OBJ_PATH):
        return trimesh.load(CANONICAL_OBJ_PATH, force="mesh", process=False)
    else:
        return trimesh.creation.icosphere(subdivisions=3, radius=8.0)


def extract_landmarks_from_image(image_input) -> np.ndarray | None:
    """Extract 478 3D landmarks (x, y, z) from an input image using MediaPipe FaceLandmarker."""
    try:
        import mediapipe as mp
        
        model_file = ensure_model_asset()
        if not model_file:
            return None

        if isinstance(image_input, str):
            image = cv2.imread(image_input)
            if image is None:
                return None
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        elif isinstance(image_input, np.ndarray):
            image_rgb = image_input
        elif isinstance(image_input, Image.Image):
            image_rgb = np.array(image_input)
        else:
            return None

        h, w, _ = image_rgb.shape
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
        
        BaseOptions = mp.tasks.BaseOptions
        FaceLandmarker = mp.tasks.vision.FaceLandmarker
        FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
        VisionRunningMode = mp.tasks.vision.RunningMode

        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_file),
            running_mode=VisionRunningMode.IMAGE,
            num_faces=1
        )

        with FaceLandmarker.create_from_options(options) as landmarker:
            result = landmarker.detect(mp_image)
            
            if not result.face_landmarks or len(result.face_landmarks) == 0:
                return None

            landmarks = result.face_landmarks[0]
            coords = []
            for lm in landmarks:
                x = (lm.x - 0.5) * w / max(h, w)
                y = -(lm.y - 0.5) * h / max(h, w)
                z = -lm.z * w / max(h, w)
                coords.append([x, y, z])
                
            return np.array(coords)
    except Exception as e:
        print(f"Error extracting landmarks: {e}")
        return None


def deform_face_mesh(base_mesh: trimesh.Trimesh, landmarks_3d: np.ndarray) -> trimesh.Trimesh:
    """Deform base canonical face mesh vertices smoothly to align with photo landmarks."""
    deformed_mesh = base_mesh.copy()
    verts = deformed_mesh.vertices.copy()
    
    num_verts = len(verts)
    num_lms = len(landmarks_3d)
    min_count = min(num_verts, num_lms)
    
    if min_count > 10:
        base_pts = verts[:min_count]
        target_pts = landmarks_3d[:min_count]
        
        target_center = np.mean(target_pts, axis=0)
        target_centered = target_pts - target_center
        
        base_center = np.mean(base_pts, axis=0)
        base_scale = np.max(np.linalg.norm(base_pts - base_center, axis=1))
        target_scale = np.max(np.linalg.norm(target_centered, axis=1))
        
        if target_scale > 1e-6:
            scaled_target = target_centered * (base_scale / target_scale) + base_center
            verts[:min_count] = 0.85 * scaled_target + 0.15 * base_pts
            
    deformed_mesh.vertices = verts
    return deformed_mesh


def compute_anatomical_frame(face_mesh: trimesh.Trimesh):
    """
    Calculate orthogonal anatomical coordinate frame (X_axis, Y_axis, Z_axis)
    from MediaPipe face landmarks.
    """
    verts = face_mesh.vertices
    glabella = verts[168]      # Brow line
    hairline = verts[10]       # Hairline
    subnasale = verts[2]       # Nose base
    chin = verts[152]          # Chin tip
    left_temple = verts[234]   # Right side of screen / subject left
    right_temple = verts[454]  # Left side of screen / subject right

    x_axis = right_temple - left_temple
    x_axis /= np.linalg.norm(x_axis)

    y_axis = hairline - chin
    y_axis = y_axis - np.dot(y_axis, x_axis) * x_axis
    y_axis /= np.linalg.norm(y_axis)

    z_axis = np.cross(x_axis, y_axis)
    z_axis /= np.linalg.norm(z_axis)

    return {
        "glabella": glabella,
        "hairline": hairline,
        "subnasale": subnasale,
        "chin": chin,
        "left_temple": left_temple,
        "right_temple": right_temple,
        "x_axis": x_axis,
        "y_axis": y_axis,
        "z_axis": z_axis,
    }


def build_wireframe_cranial_sphere_geometry(face_mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Build transformed cranial sphere geometry for wireframe edge rendering."""
    frame = compute_anatomical_frame(face_mesh)
    glabella = frame["glabella"]
    hairline = frame["hairline"]
    chin = frame["chin"]
    x_axis = frame["x_axis"]
    y_axis = frame["y_axis"]
    z_axis = frame["z_axis"]

    face_h = np.linalg.norm(hairline - chin)
    radius = float(face_h * 0.50)
    center = glabella - (z_axis * (radius * 1.02)) + (y_axis * (radius * 0.04))

    sphere_mesh = trimesh.creation.icosphere(subdivisions=2, radius=radius)
    s_verts = sphere_mesh.vertices.copy()
    side_clip = radius * 0.84
    s_verts[:, 0] = np.clip(s_verts[:, 0], -side_clip, side_clip)
    sphere_mesh.vertices = s_verts

    rot_mat = np.eye(4)
    rot_mat[:3, 0] = x_axis
    rot_mat[:3, 1] = y_axis
    rot_mat[:3, 2] = z_axis
    sphere_mesh.apply_transform(rot_mat)
    sphere_mesh.apply_translation(center)
    return sphere_mesh


def compute_loomis_measurement_scale(face_mesh: trimesh.Trimesh):
    """
    Compute 3D Parallel Measurement Scale Rod and Ticks (Measured Anatomy vs Ideal Loomis Thirds).
    """
    frame = compute_anatomical_frame(face_mesh)
    glabella = frame["glabella"]
    hairline = frame["hairline"]
    subnasale = frame["subnasale"]
    chin = frame["chin"]
    left_temple = frame["left_temple"]
    right_temple = frame["right_temple"]
    x_axis = frame["x_axis"]
    y_axis = frame["y_axis"]
    z_axis = frame["z_axis"]

    face_h = np.linalg.norm(hairline - chin)

    y_hairline = np.dot(hairline, y_axis)
    y_brow = np.dot(glabella, y_axis)
    y_nose = np.dot(subnasale, y_axis)
    y_chin = np.dot(chin, y_axis)

    total_h = y_hairline - y_chin
    ideal_unit = total_h / 3.0
    y_ideal_brow = y_hairline - ideal_unit
    y_ideal_nose = y_hairline - (2.0 * ideal_unit)

    scale_x_offset = np.linalg.norm(right_temple - left_temple) * 0.42
    scale_z_offset = max(12.0, face_h * 0.15)
    scale_base_origin = chin + (x_axis * scale_x_offset) + (z_axis * scale_z_offset)

    bar_start = scale_base_origin + y_axis * (y_chin - np.dot(scale_base_origin, y_axis))
    bar_end = scale_base_origin + y_axis * (y_hairline - np.dot(scale_base_origin, y_axis))
    scale_bar_pts = np.array([bar_start, bar_end])

    tick_len = max(12.0, face_h * 0.15)

    def make_tick(y_val, length=tick_len):
        pt_base = scale_base_origin + y_axis * (y_val - np.dot(scale_base_origin, y_axis))
        pt_ext = pt_base + (x_axis * length)
        return np.array([pt_base, pt_ext])

    ticks_detected = [
        make_tick(y_hairline),
        make_tick(y_brow),
        make_tick(y_nose),
        make_tick(y_chin),
    ]

    ticks_ideal = [
        make_tick(y_ideal_brow, length=tick_len * 1.3),
        make_tick(y_ideal_nose, length=tick_len * 1.3),
    ]

    return {
        "scale_bar_pts": scale_bar_pts,
        "ticks_detected": ticks_detected,
        "ticks_ideal": ticks_ideal,
    }


def compute_construction_rings(face_mesh: trimesh.Trimesh):
    """
    Compute 3D Construction Rings: Brow Ring, Midline Ring, Coronal Ring, Side Discs & Crosshairs.
    """
    frame = compute_anatomical_frame(face_mesh)
    glabella = frame["glabella"]
    hairline = frame["hairline"]
    chin = frame["chin"]
    x_axis = frame["x_axis"]
    y_axis = frame["y_axis"]
    z_axis = frame["z_axis"]

    face_h = np.linalg.norm(hairline - chin)
    radius = float(face_h * 0.50)
    center = glabella - (z_axis * (radius * 1.02)) + (y_axis * (radius * 0.04))
    side_clip = radius * 0.84

    theta = np.linspace(0, 2 * np.pi, 96)
    
    brow_ring_pts = np.array([
        center + (radius * 0.99) * (0.86 * np.cos(t) * x_axis - np.sin(t) * z_axis)
        for t in theta
    ])
    
    midline_ring_pts = np.array([
        center + (radius * 0.99) * (np.cos(t) * y_axis - np.sin(t) * z_axis)
        for t in theta
    ])
    
    coronal_ring_pts = np.array([
        center + (radius * 0.99) * (0.86 * np.cos(t) * x_axis + np.sin(t) * y_axis)
        for t in theta
    ])

    disc_radius = radius * 0.53
    side_rings_pts = []
    side_cross_pts = []
    
    for side_sign in [-1.0, 1.0]:
        disc_center = center + (side_sign * side_clip * x_axis)
        ring_pts = np.array([
            disc_center + disc_radius * (np.cos(t) * z_axis + np.sin(t) * y_axis)
            for t in theta
        ])
        side_rings_pts.append(ring_pts)
        
        cross_h = np.array([disc_center - (disc_radius * z_axis), disc_center + (disc_radius * z_axis)])
        cross_v = np.array([disc_center - (disc_radius * y_axis), disc_center + (disc_radius * y_axis)])
        side_cross_pts.extend([cross_h, cross_v])

    return {
        "brow_ring_pts": brow_ring_pts,
        "midline_ring_pts": midline_ring_pts,
        "coronal_ring_pts": coronal_ring_pts,
        "side_rings_pts": side_rings_pts,
        "side_cross_pts": side_cross_pts,
    }

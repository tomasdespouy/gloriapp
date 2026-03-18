"""
V4 Image Generation Pipeline
1. Generate 1024x1024 with strict prompt
2. Validate: face detected, face ratio, no borders
3. Smart crop to 40% face ratio
4. Validate post-crop
5. Max 3 attempts per patient

Usage:
  python scripts/gen_image_v4.py "Altagracia Marte" "Patricia Hernández"
"""
import sys
import os
import io
import json
import numpy as np
from PIL import Image
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

# Setup
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
MODEL_PATH = os.path.join(SCRIPT_DIR, "blaze_face_short_range.tflite")
OUTPUT_SIZE = 512
TARGET_RATIO = 0.40
MIN_RATIO = 0.32
MAX_RATIO = 0.52
MAX_ATTEMPTS = 3

# Load env
env = {}
with open(os.path.join(PROJECT_DIR, ".env.local")) as f:
    for line in f:
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            env[k] = v

# Download face model if needed
if not os.path.exists(MODEL_PATH):
    import urllib.request
    print("Downloading face detection model...")
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
        MODEL_PATH
    )

from google import genai
from google.genai import types
from supabase import create_client

client = genai.Client(api_key=env["GOOGLE_API_KEY"])
sb = create_client(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])


def detect_face(img_pil):
    arr = np.array(img_pil.convert("RGB"))
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
    options = vision.FaceDetectorOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        min_detection_confidence=0.5,
    )
    detector = vision.FaceDetector.create_from_options(options)
    results = detector.detect(mp_image)
    if not results.detections:
        return None
    best = None
    best_area = 0
    for det in results.detections:
        bb = det.bounding_box
        if bb.width * bb.height > best_area:
            best_area = bb.width * bb.height
            best = (bb.origin_x, bb.origin_y, bb.width, bb.height)
    return best


def check_borders(img_pil):
    """Check if image has a visible FRAME or MARGIN (not just uniform background).
    A solid background extending to edges is OK (passport style).
    A distinct colored frame/border around the photo is NOT OK."""
    arr = np.array(img_pil.convert("RGB"))
    h, w = arr.shape[:2]

    # Check for a distinct inner rectangle (frame effect)
    # Sample outer ring (5px) and inner ring (15-25px from edge)
    outer = np.concatenate([
        arr[:5, :, :].reshape(-1, 3),
        arr[-5:, :, :].reshape(-1, 3),
        arr[:, :5, :].reshape(-1, 3),
        arr[:, -5:, :].reshape(-1, 3),
    ])
    inner = np.concatenate([
        arr[20:25, 20:-20, :].reshape(-1, 3),
        arr[-25:-20, 20:-20, :].reshape(-1, 3),
        arr[20:-20, 20:25, :].reshape(-1, 3),
        arr[20:-20, -25:-20, :].reshape(-1, 3),
    ])

    outer_med = np.median(outer, axis=0)
    inner_med = np.median(inner, axis=0)
    diff = np.linalg.norm(outer_med - inner_med)

    # If outer and inner ring are very different, there's a frame
    if diff > 60:
        return False, f"Frame detected (outer vs inner diff={diff:.0f})"

    return True, "OK"


def smart_crop(img, target_ratio=TARGET_RATIO):
    w_img, h_img = img.size
    face = detect_face(img)
    if face is None:
        side = min(w_img, h_img)
        left = (w_img - side) // 2
        top = (h_img - side) // 2
        return img.crop((left, top, left + side, top + side)).resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)

    fx, fy, fw, fh = face
    face_cx = fx + fw // 2
    face_cy = fy + fh // 2

    crop_size = int(fh / target_ratio)
    crop_size = max(crop_size, fh + 40)
    crop_size = min(crop_size, w_img, h_img)

    left = max(0, min(face_cx - crop_size // 2, w_img - crop_size))
    top = max(0, min(face_cy - crop_size // 2, h_img - crop_size))

    # Ensure forehead visible
    forehead = int(fh * 0.5)
    if fy - forehead < top:
        top = max(0, fy - forehead)

    # Ensure chin visible
    chin = int(fh * 0.3)
    if fy + fh + chin > top + crop_size:
        top = max(0, fy + fh + chin - crop_size)

    right = min(left + crop_size, w_img)
    bottom = min(top + crop_size, h_img)
    actual = min(right - left, bottom - top)

    cropped = img.crop((left, top, left + actual, top + actual))
    return cropped.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)


def age_details(age):
    if age <= 25:
        return "youthful skin, no wrinkles, smooth forehead, full cheeks, possible minor blemishes"
    if age <= 35:
        return "early subtle expression lines, youthful but mature, slight nasolabial folds"
    if age <= 45:
        return "visible expression lines around eyes and mouth, forehead lines, skin losing elasticity"
    if age <= 55:
        return "prominent wrinkles, crow's feet, visible forehead lines, nasolabial folds, slight jaw sagging"
    if age <= 65:
        return "deep wrinkles on forehead and around eyes, pronounced nasolabial folds, sagging jaw and neck, age spots, thinning skin — clearly ELDERLY not middle-aged"
    return "very deep wrinkles, heavily aged, pronounced jowls, sunken cheeks, age spots, thin fragile skin — clearly OVER 65"


def build_prompt(patient, vi):
    gender = vi.get("gender", "person")
    age = patient["age"]
    country = patient["country"]
    if isinstance(country, list):
        country = country[0]

    extras = vi.get("accesorios", "Sin accesorios")
    extras_str = f"{extras}." if extras != "Sin accesorios" else ""

    return (
        f"Passport photo of a {age} year old {gender}. "
        f"{age_details(age)}. "
        f"{vi['etnia']}. "
        f"{vi['pelo_estilo']}, {vi['pelo_color']} hair. "
        f"{vi['tez']} skin. "
        f"Wearing {vi['ropa_tipo']} in {vi['ropa_color']}. "
        f"{extras_str}"
        f"Solid {vi['fondo']} background. "
        f"Head and shoulders with space around them, centered, looking at camera. Studio lighting. Photorealistic."
    )


def slugify(name):
    import unicodedata
    s = unicodedata.normalize("NFD", name.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace(" ", "-")


def generate_and_validate(patient, vi):
    slug = slugify(patient["name"])
    prompt = build_prompt(patient, vi)

    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"  Attempt {attempt}/{MAX_ATTEMPTS}...")

        # Generate
        try:
            response = client.models.generate_images(
                model="imagen-4.0-generate-001",
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="1:1",
                    person_generation="ALLOW_ADULT",
                    output_mime_type="image/png",
                ),
            )
            img_bytes = response.generated_images[0].image.image_bytes
            raw = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        except Exception as e:
            print(f"    Generation failed: {str(e)[:80]}")
            continue

        print(f"    Generated {raw.size}")

        # Validate face
        face = detect_face(raw)
        if not face:
            print("    REJECT: No face detected")
            continue

        _, _, _, fh = face
        ratio = fh / min(raw.size)
        print(f"    Face ratio: {ratio:.1%}")

        # Smart crop
        cropped = smart_crop(raw)

        # Validate post-crop
        face2 = detect_face(cropped)
        if not face2:
            print("    REJECT: Face lost after crop")
            continue

        _, _, _, fh2 = face2
        ratio2 = fh2 / OUTPUT_SIZE
        print(f"    Post-crop face ratio: {ratio2:.1%}")

        if ratio2 < MIN_RATIO or ratio2 > MAX_RATIO:
            print(f"    REJECT: Face ratio {ratio2:.1%} outside {MIN_RATIO:.0%}-{MAX_RATIO:.0%}")
            continue

        # Validate borders
        borders_ok, border_msg = check_borders(cropped)
        if not borders_ok:
            print(f"    REJECT: {border_msg}")
            continue

        # All validations passed
        print(f"    PASS: ratio={ratio2:.1%}, borders=OK")
        return cropped

    return None


def main():
    names = sys.argv[1:] if len(sys.argv) > 1 else []
    if not names:
        print("Usage: python scripts/gen_image_v4.py \"Name1\" \"Name2\"")
        return

    print(f"=== V4 Pipeline: {len(names)} patients ===\n")

    for name in names:
        print(f"\n{name}")

        # Get patient data
        result = sb.table("ai_patients").select("name, age, country, visual_identity").eq("name", name).single().execute()
        patient = result.data
        if not patient:
            print("  NOT FOUND")
            continue

        vi = patient["visual_identity"]
        if not vi:
            print("  No visual_identity")
            continue

        print(f"  {patient['age']}y, {vi.get('gender','?')}, {patient['country']}")

        img = generate_and_validate(patient, vi)
        if img is None:
            print("  FAILED after 3 attempts")
            continue

        # Save locally for review
        slug = slugify(name)
        local_path = os.path.join(PROJECT_DIR, f"_v4_{slug}.png")
        img.save(local_path, optimize=True)
        size_kb = os.path.getsize(local_path) // 1024
        print(f"  Saved: {local_path} ({size_kb} KB)")

    print("\n=== Done ===")
    print("Review _v4_*.png files, then run with --upload to push to Supabase")


if __name__ == "__main__":
    main()

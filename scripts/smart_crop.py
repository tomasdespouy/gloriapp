"""
Smart crop: detect face, crop so face is ~40% of frame, output 512x512.
No white borders — crops from the original image only.
Uses mediapipe 0.10+ API.

Usage:
  python scripts/smart_crop.py input.png output.png
"""
import sys
import numpy as np
from PIL import Image
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

TARGET_RATIO = 0.38
MAX_RATIO = 0.45
OUTPUT_SIZE = 512

# Download model if needed
import urllib.request, os
MODEL_PATH = os.path.join(os.path.dirname(__file__), "blaze_face_short_range.tflite")
if not os.path.exists(MODEL_PATH):
    print("Downloading face detection model...")
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
        MODEL_PATH
    )


def detect_face(img_pil):
    """Returns (x, y, w, h) of the largest face in pixels, or None."""
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
        area = bb.width * bb.height
        if area > best_area:
            best_area = area
            best = (bb.origin_x, bb.origin_y, bb.width, bb.height)

    return best


def smart_crop(img, target_ratio=TARGET_RATIO):
    """Crop image so face is ~target_ratio of the output height."""
    w_img, h_img = img.size
    face = detect_face(img)

    if face is None:
        # No face — center crop to square
        side = min(w_img, h_img)
        left = (w_img - side) // 2
        top = (h_img - side) // 2
        return img.crop((left, top, left + side, top + side)).resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)

    fx, fy, fw, fh = face
    face_cx = fx + fw // 2
    face_cy = fy + fh // 2

    # Check if face is too large for the image (can't crop enough)
    current_ratio = fh / min(w_img, h_img)
    if current_ratio > MAX_RATIO:
        # Face is too big — need to pad the image with background color first
        # Sample background color from corners
        corners = [img.getpixel((5, 5)), img.getpixel((w_img-5, 5)),
                   img.getpixel((5, h_img-5)), img.getpixel((w_img-5, h_img-5))]
        avg_bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

        # Calculate needed canvas size so face = target_ratio
        needed_size = int(fh / target_ratio)
        pad_w = max(0, (needed_size - w_img) // 2)
        pad_h = max(0, (needed_size - h_img) // 2)

        padded = Image.new("RGB", (w_img + pad_w * 2, h_img + pad_h * 2), avg_bg)
        padded.paste(img, (pad_w, pad_h))

        # Update coordinates
        img = padded
        w_img, h_img = img.size
        fx += pad_w
        fy += pad_h
        face_cx = fx + fw // 2
        face_cy = fy + fh // 2

    # Desired crop: face_height / crop_size = target_ratio
    crop_size = int(fh / target_ratio)
    crop_size = max(crop_size, fh + 40)  # at minimum, fit the face
    crop_size = min(crop_size, w_img, h_img)  # can't exceed image

    # Center on face
    left = face_cx - crop_size // 2
    top = face_cy - crop_size // 2

    # Keep within bounds
    left = max(0, min(left, w_img - crop_size))
    top = max(0, min(top, h_img - crop_size))

    # Ensure forehead visible
    forehead = int(fh * 0.5)
    if fy - forehead < top:
        top = max(0, fy - forehead)
        if top + crop_size > h_img:
            crop_size = h_img - top

    # Ensure chin visible
    chin = int(fh * 0.3)
    if fy + fh + chin > top + crop_size:
        needed_top = fy + fh + chin - crop_size
        top = max(0, needed_top)

    # Square crop
    right = min(left + crop_size, w_img)
    bottom = min(top + crop_size, h_img)
    actual_size = min(right - left, bottom - top)
    right = left + actual_size
    bottom = top + actual_size

    cropped = img.crop((left, top, right, bottom))
    return cropped.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)


if __name__ == "__main__":
    input_path = sys.argv[1]
    output_path = sys.argv[2]

    img = Image.open(input_path)
    print(f"Input: {img.size}")

    # Before
    face_before = detect_face(img)
    if face_before:
        _, _, _, fh = face_before
        ratio_before = fh / min(img.size)
        print(f"Before crop: face={fh}px, ratio={ratio_before:.1%}")

    result = smart_crop(img)
    result.save(output_path, optimize=True)

    # After
    face_after = detect_face(result)
    if face_after:
        _, _, _, fh2 = face_after
        ratio_after = fh2 / OUTPUT_SIZE
        print(f"After crop:  face={fh2}px, ratio={ratio_after:.1%}")
    else:
        print("After crop: no face detected")

    print(f"Output: {result.size}, saved to {output_path}")

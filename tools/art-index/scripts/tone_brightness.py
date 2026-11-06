"""Brightness of the artwork pixels, on the desktop client's 0–255 scale."""
from PIL import Image, ImageChops


def measure_brightness(image):
    sample = image.convert('RGBA')
    sample.thumbnail((48, 48), Image.Resampling.LANCZOS)
    total = 0.0
    opacity = 0
    for red, green, blue, alpha in sample.getdata():
        total += alpha * (.2126 * red + .7152 * green + .0722 * blue)
        opacity += alpha
    return int(total / opacity + .5) if opacity else None


def measure_legacy_preview(image, padding):
    """Remove the inference canvas's symmetric letterbox from old cached previews."""
    image = image.convert('RGB')
    bounds = ImageChops.difference(image, Image.new('RGB', image.size, padding)).getbbox()
    if bounds:
        left, top, right, bottom = bounds
        width, height = image.size
        horizontal = min(left, width - right)
        vertical = min(top, height - bottom)
        if horizontal > vertical:
            image = image.crop((horizontal, 0, width - horizontal, height))
        elif vertical:
            image = image.crop((0, vertical, width, height - vertical))
    return measure_brightness(image)

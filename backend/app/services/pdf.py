from __future__ import annotations

import io
from pathlib import Path

from PIL import Image

MAX_PAGES = 4
MAX_DIM = 1600


def _resize(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    w, h = img.size
    scale = min(1.0, MAX_DIM / max(w, h))
    if scale < 1.0:
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    return img


def _to_png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    _resize(img).save(buf, format="PNG")
    return buf.getvalue()


def document_to_images(path: str, mime: str) -> list[bytes]:
    p = Path(path)
    if mime == "application/pdf" or p.suffix.lower() == ".pdf":
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(str(p))
        pages: list[bytes] = []
        try:
            for i in range(min(len(pdf), MAX_PAGES)):
                page = pdf[i]
                bitmap = page.render(scale=1.8)
                pil = bitmap.to_pil()
                pages.append(_to_png_bytes(pil))
        finally:
            pdf.close()
        return pages

    with Image.open(p) as img:
        return [_to_png_bytes(img)]

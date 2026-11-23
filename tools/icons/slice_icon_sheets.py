"""Slice Codex-generated 3x3 icon sheets (white background) into transparent card icons.

Usage: python tools/icons/slice_icon_sheets.py <sheet_dir> <out_dir>
Sheets: sheet1.png, sheet2.png, sheet3.png generated with `codex exec` image generation
(prompts are recorded in GAME_DESIGN.md). Each sheet is a 3x3 grid on plain white.

Background removal: flood-fill from the sheet border with a tolerance, so white *inside* an icon
(highlights, the TV play button) survives because the thick navy outline encloses it. Each
non-background connected component is assigned to the grid cell that holds its centroid, so an
icon whose sparkles or ripples cross a cell edge still ends up whole.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

NAMES = {
    "sheet1.png": ["clean-speed", "move-speed", "coin", "radius", "ad-gems", "coin-boost", "exchange", "gems", "remove-ads"],
    "sheet2.png": ["region-yard", "region-garden", "region-stone", "region-park", "region-beach", "leaf", "can", "trophy", "timer"],
    "sheet3.png": ["grass", "stone", "trash-bag", "combo", "coin-stack", "map", "total-cleaned", "boulder", "podium"],
}
SIZE = 160      # displayed at ~54 CSS px; 3x for high-DPI phones
PAD = 6         # transparent padding inside the square
TOLERANCE = 38  # how far from pure white still counts as background


def background_mask(rgb):
    near_white = (255 - rgb.min(axis=2)) <= TOLERANCE
    labels, _ = ndimage.label(near_white)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    border = border[border > 0]
    return np.isin(labels, border)


def main(sheet_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for sheet, names in NAMES.items():
        img = Image.open(os.path.join(sheet_dir, sheet)).convert("RGB")
        rgb = np.asarray(img).astype(np.int16)
        h, w, _ = rgb.shape
        bg = background_mask(rgb)
        # soft edge: background pixels touching the icon fade by how white they are (anti-aliasing halo)
        alpha = np.where(bg, 0, 255).astype(np.float32)
        edge = bg & ndimage.binary_dilation(~bg, iterations=2)
        whiteness = (255 - rgb.min(axis=2)) / TOLERANCE
        alpha[edge] = np.clip(whiteness[edge], 0, 1) * 255
        fg = alpha > 8
        labels, count = ndimage.label(fg)
        centroids = ndimage.center_of_mass(fg, labels, range(1, count + 1))
        sizes = ndimage.sum(fg, labels, range(1, count + 1))
        cells = [np.zeros_like(fg) for _ in range(9)]
        for idx, ((cy, cx), size) in enumerate(zip(centroids, sizes), start=1):
            if size < 30:  # stray specks
                continue
            cell = min(int(cy / (h / 3)), 2) * 3 + min(int(cx / (w / 3)), 2)
            cells[cell] |= labels == idx
        rgba = np.dstack([rgb.astype(np.uint8), alpha.astype(np.uint8)])
        for cell, name in enumerate(names):
            ys, xs = np.nonzero(cells[cell])
            y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            crop = rgba[y0:y1, x0:x1].copy()
            crop[..., 3] = np.where(cells[cell][y0:y1, x0:x1], crop[..., 3], 0)
            tile = Image.fromarray(crop, "RGBA")
            side = max(tile.size)
            square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            square.paste(tile, ((side - tile.width) // 2, (side - tile.height) // 2))
            inner = SIZE - PAD * 2
            square = square.resize((inner, inner), Image.LANCZOS)
            out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            out.paste(square, (PAD, PAD))
            out.save(os.path.join(out_dir, f"Yardsweep-Icon-{name}.png"), optimize=True)
            print("saved", name)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
